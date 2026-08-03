"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  SlidersHorizontal,
  Target as TargetIcon,
  UserRound,
  Building2,
  Clock,
  Repeat,
  StickyNote,
  Pencil,
  Trash2,
  X,
  CalendarOff,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { RingProgress } from "@/components/ui/RingProgress";
import { Input } from "@/components/ui/Input";
import { TaskDetailSheet, type TaskDraft } from "@/components/TaskDetailSheet";
import { TaskCompleteSheet } from "@/components/TaskCompleteSheet";
import { MiniCalendar } from "@/components/PlanCalendar";
import { useActivities, taskActivityId } from "@/components/ActivityProvider";
import { useRbac } from "@/components/RbacProvider";
import { useLeave } from "@/components/LeaveProvider";
import { LeaveRequestSheet } from "@/components/LeaveRequestSheet";
import { coversDate } from "@/lib/leave";
import { listEmployees } from "@/lib/team";
import { ACTION_GROUPS } from "@/lib/actions";
import {
  DEFAULT_QUICK_ACTIONS,
  loadQuickActions,
  saveQuickActions,
  type QuickAction,
} from "@/lib/quickAdd";
import { formatDate } from "@/lib/format";
import {
  listTasks,
  getTarget,
  TASK_TYPES,
  TASK_TYPE_ORDER,
  TODAY,
  type Task,
  type TaskType,
} from "@/lib/momentum";
import { cn } from "@/lib/cn";

function addDays(iso: string, n: number): string {
  // Parse + format in UTC so the date never shifts across timezones.
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function relLabel(iso: string): string | null {
  if (iso === TODAY) return "วันนี้";
  if (iso === addDays(TODAY, 1)) return "พรุ่งนี้";
  if (iso === addDays(TODAY, -1)) return "เมื่อวาน";
  return null;
}

// Monotonic id source. Deriving ids from `tasks.length` is unsafe: the array SHRINKS on
// delete, so the next task can reuse a departed task's id — and since the logged activity's
// id is derived from the task id (`taskActivityId`), two tasks would then fight over one
// activity row. A counter never goes backwards. Wire = a DB-generated id.
let taskSeq = 0;
const newTaskId = () => `t_${++taskSeq}`;

export function DailyPlan({ agent }: { agent: string }) {
  const [tasks, setTasks] = React.useState<Task[]>(() => listTasks(agent));
  const [date, setDate] = React.useState(TODAY);
  const [draft, setDraft] = React.useState("");
  const [draftType, setDraftType] = React.useState<TaskType>("work");
  const [sheet, setSheet] = React.useState<{ open: boolean; task: Task | null }>({
    open: false,
    task: null,
  });
  const [calOpen, setCalOpen] = React.useState(false);
  const [completing, setCompleting] = React.useState<Task | null>(null);
  const { logActivity, removeActivity } = useActivities();

  // ⚠️ IDENTITY: this screen belongs to ONE person — the `agent` prop. Today `/today`
  // passes `currentAgent()`, which is hardcoded to SAMPLE_AGENT ("Stone") because the seed
  // tasks/targets only exist for them; it does NOT follow the view-as switcher.
  //
  // Everything owner-scoped here (tasks, logged activity, Quick Add presets, leave) is keyed
  // off that same `agent`, deliberately. An earlier version mixed the two — activity written
  // as Stone while the leave banner followed the switched user — so the plan could show
  // someone else's leave. Keep them aligned.
  //
  // `can()` stays viewer-scoped: permissions belong to whoever is looking, not to the plan's
  // owner. Wire = replace `currentAgent()` with the session user; then the two converge.
  const { can } = useRbac();
  const { requests } = useLeave();
  const [leaveOpen, setLeaveOpen] = React.useState(false);
  const planOwner = React.useMemo(
    () => listEmployees().find((e) => e.nickname === agent),
    [agent]
  );
  const myLeaveToday = planOwner
    ? requests.find((r) => r.employeeId === planOwner.id && coversDate(r, date))
    : undefined;

  // Quick Add presets — per-user, loaded after mount so the server render matches.
  const [quick, setQuick] = React.useState<QuickAction[]>(DEFAULT_QUICK_ACTIONS);
  const [quickEdit, setQuickEdit] = React.useState(false);
  React.useEffect(() => setQuick(loadQuickActions(agent)), [agent]);
  const applyQuick = (next: QuickAction[]) => {
    setQuick(next);
    saveQuickActions(agent, next);
  };

  const dayTasks = tasks
    .filter((t) => t.date === date)
    .sort((a, b) => a.order - b.order);
  const doneCount = dayTasks.filter((t) => t.done).length;
  const pct = dayTasks.length ? Math.round((doneCount / dayTasks.length) * 100) : 0;

  // ── Task → activity bridge ────────────────────────────────────────────────
  // Completing a task carrying an `activityType` WRITES an activity row. Since the
  // +บันทึก FAB was removed (CEO feedback R1), this is the only path by which activity
  // reaches the KPI targets, the new-sales rank ladder, and the entity timelines.
  //
  // Tick a linked task → confirm sheet (count + remark) → log. Untick → remove the row, so
  // a mis-tick doesn't leave a phantom activity behind. Unlinked tasks just tick.
  //
  // `canLog` re-gates activity.log. Deleting the FAB removed the app's ONLY check on that
  // permission, so a role without it (Marketing / Listing Support / Admin) could log by
  // ticking an action-linked task — contradicting the matrix the wiring pass must mirror in
  // RLS. Without the permission a task still ticks; it just doesn't write an activity.
  const canLog = can("activity.log");

  const toggle = (id: string) => {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    if (!t.done && t.activityType && canLog) {
      setCompleting(t);
      return;
    }
    if (t.done && t.activityType && canLog) removeActivity(taskActivityId(t.id));
    setTasks((ts) => ts.map((x) => (x.id === id ? { ...x, done: !x.done } : x)));
  };

  const confirmComplete = (count: number, remark: string) => {
    const t = completing;
    if (!t) return;
    logActivity({
      id: taskActivityId(t.id),
      created_by: agent,
      action: t.activityType!,
      // The TASK's date, not today — ticking a back-dated plan item logs it on that day.
      date: t.date,
      count,
      remark: remark || null,
      related_lead_id: t.relatedLeadId ?? null,
      related_lead_name: t.relatedLeadName ?? null,
      related_listing_id: t.relatedListingId ?? null,
      related_listing_name: t.relatedListingName ?? null,
    });
    setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, done: true } : x)));
    setCompleting(null);
  };

  const cycleType = (id: string) =>
    setTasks((ts) =>
      ts.map((t) =>
        t.id === id
          ? { ...t, type: TASK_TYPE_ORDER[(TASK_TYPE_ORDER.indexOf(t.type) + 1) % TASK_TYPE_ORDER.length] }
          : t
      )
    );

  const add = () => {
    const title = draft.trim();
    if (!title) return;
    // TODO (wiring): smart time parse — if the quick-add text starts with a time
    // (e.g. "10.00 นั่งสมาธิ" / "10:00 นั่งสมาธิ"), extract HH:MM into startTime and
    // strip it from the title. Quick-add only. See HANDOVER_CHECKLIST → Momentum.
    const order = Math.max(-1, ...dayTasks.map((t) => t.order)) + 1;
    setTasks((ts) => [
      ...ts,
      { id: newTaskId(), agent, date, title, done: false, order, type: draftType },
    ]);
    setDraft("");
  };

  const cycleDraftType = () =>
    setDraftType((t) => TASK_TYPE_ORDER[(TASK_TYPE_ORDER.indexOf(t) + 1) % TASK_TYPE_ORDER.length]);

  /** Quick Add — appends an UNTICKED task. It's a plan, not a log: the tick is what
   *  records the activity. Time / notes / linked entity get filled in afterwards. */
  const addQuick = (qa: QuickAction) => {
    const order = Math.max(-1, ...dayTasks.map((t) => t.order)) + 1;
    setTasks((ts) => [
      ...ts,
      {
        id: newTaskId(),
        agent,
        date,
        title: qa.label,
        done: false,
        order,
        type: qa.type,
        activityType: qa.activityType,
      },
    ]);
  };

  // Advanced add / edit via the detail sheet.
  //
  // Editing a task that has ALREADY been ticked must keep its logged activity in sync —
  // otherwise changing the action leaves the old one counted, and clearing the action
  // strands a row that can never be removed (untick only fires for tasks that still carry
  // an activityType). Both cases silently inflate KPI targets and the probation ladder.
  const applyDraft = (d: TaskDraft) => {
    if (sheet.task) {
      const prev = sheet.task;
      const next: Task = { ...prev, ...d };
      if (prev.done && canLog) {
        if (!next.activityType) {
          // Action removed from a completed task → drop the activity it produced.
          removeActivity(taskActivityId(prev.id));
        } else {
          // Re-log under the same id: action/date/entity may all have changed.
          logActivity({
            id: taskActivityId(prev.id),
            created_by: agent,
            action: next.activityType,
            date: next.date,
            count: 1,
            remark: null,
            related_lead_id: next.relatedLeadId ?? null,
            related_lead_name: next.relatedLeadName ?? null,
            related_listing_id: next.relatedListingId ?? null,
            related_listing_name: next.relatedListingName ?? null,
          });
        }
      }
      setTasks((ts) => ts.map((t) => (t.id === prev.id ? next : t)));
    } else {
      const order = Math.max(-1, ...dayTasks.map((t) => t.order)) + 1;
      setTasks((ts) => [...ts, { id: newTaskId(), agent, date, done: false, order, ...d }]);
    }
  };

  const deleteTask = () => {
    if (!sheet.task) return;
    const { id, done, activityType } = sheet.task;
    // Deleting a COMPLETED task must also delete the activity it logged, or the row lives
    // on forever with no UI left to remove it — permanently overstating effort.
    if (done && activityType && canLog) removeActivity(taskActivityId(id));
    setTasks((ts) => ts.filter((t) => t.id !== id));
  };

  const rel = relLabel(date);

  return (
    <Card>
      {/* Header: date nav + ring */}
      <div className="flex items-center justify-between gap-3 p-4 border-b border-border">
        <div className="relative flex items-center gap-2 min-w-0">
          <button
            onClick={() => setDate((d) => addDays(d, -1))}
            aria-label="วันก่อนหน้า"
            className="size-8 grid place-items-center rounded-md border border-border text-text-muted hover:bg-surface-hover transition-colors shrink-0"
          >
            <ChevronLeft size={16} strokeWidth={1.75} />
          </button>
          {/* Date label → tap to open the month picker */}
          <button
            onClick={() => setCalOpen((o) => !o)}
            aria-label="เลือกวันที่"
            aria-expanded={calOpen}
            className="min-w-0 flex items-center gap-1.5 rounded-md px-1.5 -mx-1 py-0.5 hover:bg-surface-hover transition-colors"
          >
            <div className="min-w-0 text-left">
              <div className="text-label text-text-subtle">แผนประจำวัน{rel ? ` · ${rel}` : ""}</div>
              <div className="text-h3 num">{formatDate(date)}</div>
            </div>
            <ChevronDown
              size={15}
              strokeWidth={2}
              className={cn("text-text-subtle shrink-0 transition-transform", calOpen && "rotate-180")}
            />
          </button>
          <button
            onClick={() => setDate((d) => addDays(d, 1))}
            aria-label="วันถัดไป"
            className="size-8 grid place-items-center rounded-md border border-border text-text-muted hover:bg-surface-hover transition-colors shrink-0"
          >
            <ChevronRight size={16} strokeWidth={1.75} />
          </button>
          {date !== TODAY && (
            <button
              onClick={() => setDate(TODAY)}
              className="text-small font-medium text-accent border border-accent rounded-md px-2.5 h-8 shrink-0 hover:bg-accent-wash transition-colors"
            >
              วันนี้
            </button>
          )}

          {/* Month-picker popover — backdrop dismisses on outside tap */}
          {calOpen && (
            <>
              <div onClick={() => setCalOpen(false)} className="fixed inset-0 z-40" />
              <div className="absolute top-[calc(100%+8px)] left-0 z-50 w-[300px] max-w-[calc(100vw-48px)] p-3.5 rounded-lg bg-surface border border-border shadow-pop">
                <MiniCalendar
                  selected={date}
                  tasks={tasks}
                  onPick={(d) => {
                    setDate(d);
                    setCalOpen(false);
                  }}
                />
              </div>
            </>
          )}
        </div>
        <RingProgress pct={pct} size={56} stroke={6} />
      </div>

      <CardContent className="p-0">
        {/* On-leave banner — if the viewer has leave covering this date, say so before they
            wonder why the day is empty. Pending leave is flagged as not-yet-approved. */}
        {myLeaveToday && (
          <div className="px-4 py-2.5 border-b border-border bg-amber-bg/40 flex items-center gap-2 text-small">
            <CalendarOff size={14} strokeWidth={1.75} className="text-amber shrink-0" />
            <span className="text-text">
              คุณลา{myLeaveToday.type}วันนี้
            </span>
            <Pill tone={myLeaveToday.status === "approved" ? "green" : "amber"}>
              {myLeaveToday.status === "approved" ? "อนุมัติแล้ว" : "รออนุมัติ"}
            </Pill>
          </div>
        )}

        <div className="px-4 py-2.5 text-small text-text-muted border-b border-border">
          {dayTasks.length ? `เสร็จ ${doneCount} จาก ${dayTasks.length}` : "ยังไม่มีแผนสำหรับวันนี้"}
        </div>

        <TaskRatioBar tasks={dayTasks} />

        <ul className="divide-y divide-border">
          {dayTasks.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              onToggle={() => toggle(t.id)}
              onEdit={() => setSheet({ open: true, task: t })}
              onCycleType={() => cycleType(t.id)}
            />
          ))}
        </ul>

        {/* Quick Add — one tap drops a common task into this day. Per-user (แก้ไข to
            customise). Replaces the deleted +บันทึก FAB as the fast path. */}
        <div className="flex items-center gap-1.5 px-3 pt-3 flex-wrap">
          {quick.map((qa) => (
            <button
              key={qa.id}
              onClick={() => addQuick(qa)}
              className="inline-flex items-center gap-1 rounded-full border border-border-strong px-2.5 py-1 text-small text-text-muted hover:border-accent hover:text-accent transition-colors"
            >
              <Plus size={12} strokeWidth={2} />
              {qa.label}
            </button>
          ))}
          <button
            onClick={() => setQuickEdit(true)}
            aria-label="ตั้งค่าปุ่มลัด"
            title="ตั้งค่าปุ่มลัด"
            className="size-7 grid place-items-center rounded-full text-text-subtle hover:bg-surface-2 hover:text-text transition-colors shrink-0"
          >
            <Pencil size={13} strokeWidth={1.75} />
          </button>

          {/* ขอลา — filed from here because this is where people already plan their days.
              Defaults to the date currently shown. Gated `leave.request` (every role). */}
          {can("leave.request") && (
            <button
              onClick={() => setLeaveOpen(true)}
              className="ml-auto inline-flex items-center gap-1 rounded-full border border-border-strong px-2.5 py-1 text-small text-text-muted hover:border-accent hover:text-accent transition-colors shrink-0"
            >
              <CalendarOff size={12} strokeWidth={1.75} /> ขอลา
            </button>
          )}
        </div>

        {/* Add task — quick inline + advanced sheet */}
        <div className="flex items-center gap-2 p-3 border-t border-border mt-3">
          <button
            onClick={cycleDraftType}
            className="shrink-0"
            title="ประเภทงาน (แตะเพื่อเปลี่ยน)"
            aria-label="ประเภทงาน"
          >
            <Pill tone={TASK_TYPES[draftType].tone}>{TASK_TYPES[draftType].label}</Pill>
          </button>
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="เพิ่มงานสำหรับวันนี้…"
            className="flex-1"
          />
          <button
            onClick={() => setSheet({ open: true, task: null })}
            aria-label="เพิ่มแบบละเอียด"
            title="ตั้งค่าเพิ่มเติม (เป้าหมาย เวลา ทำซ้ำ)"
            className="size-8 grid place-items-center rounded-md border border-border-strong text-text-muted hover:bg-surface-2 transition-colors shrink-0"
          >
            <SlidersHorizontal size={15} strokeWidth={1.75} />
          </button>
          <button
            onClick={add}
            aria-label="เพิ่มงาน"
            className="size-8 grid place-items-center rounded-md bg-accent text-text-onaccent hover:bg-accent-hover transition-colors shrink-0"
          >
            <Plus size={16} strokeWidth={2} />
          </button>
        </div>
      </CardContent>

      <TaskDetailSheet
        open={sheet.open}
        mode={sheet.task ? "edit" : "add"}
        agent={agent}
        initial={sheet.task}
        onSubmit={applyDraft}
        onDelete={deleteTask}
        onClose={() => setSheet({ open: false, task: null })}
      />

      {/* Completion confirm — only for tasks that log an activity. */}
      <TaskCompleteSheet
        task={completing}
        onConfirm={confirmComplete}
        onClose={() => setCompleting(null)}
      />

      {quickEdit && (
        <QuickActionsEditor
          actions={quick}
          onChange={applyQuick}
          onClose={() => setQuickEdit(false)}
        />
      )}

      {/* ขอลา — defaults to the date currently shown in the plan. */}
      <LeaveRequestSheet
        open={leaveOpen}
        defaultDate={date}
        employeeId={planOwner?.id ?? ""}
        nickname={agent}
        onClose={() => setLeaveOpen(false)}
      />
    </Card>
  );
}

// ── Quick Add editor ─────────────────────────────────────────────────────────
// Per-user preference, so it lives here rather than in company Settings. Adding a chip
// picks an action from the SAME catalog the activity log uses (ACTION_GROUPS) — a chip
// bound to an action logs it on completion; one without is a plain to-do.
function QuickActionsEditor({
  actions,
  onChange,
  onClose,
}: {
  actions: QuickAction[];
  onChange: (next: QuickAction[]) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = React.useState("");
  const [action, setAction] = React.useState("");
  const [type, setType] = React.useState<TaskType>("build");

  const add = () => {
    const l = label.trim() || action;
    if (!l) return;
    onChange([
      ...actions,
      { id: `qa_custom_${Date.now()}`, label: l, type, activityType: action || undefined },
    ]);
    setLabel("");
    setAction("");
  };

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center">
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-surface rounded-t-xl sm:rounded-xl border border-border shadow-pop p-5 flex flex-col gap-3.5 max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-h3">ปุ่มลัด</div>
            <p className="text-label text-text-subtle mt-0.5">
              ตั้งเองได้ · แตะปุ่มลัดเพื่อเพิ่มงานเข้าแผนวันนั้นทันที
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="ปิด"
            className="size-8 grid place-items-center rounded-md text-text-subtle hover:bg-surface-hover hover:text-text transition-colors shrink-0"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          {actions.length === 0 && (
            <p className="text-small text-text-subtle py-2">ยังไม่มีปุ่มลัด</p>
          )}
          {actions.map((qa) => (
            <div key={qa.id} className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5">
              <span className="text-body flex-1 min-w-0 truncate">{qa.label}</span>
              {qa.activityType && <Pill tone="accent">{qa.activityType}</Pill>}
              <Pill tone={TASK_TYPES[qa.type].tone}>{TASK_TYPES[qa.type].label}</Pill>
              <button
                onClick={() => onChange(actions.filter((x) => x.id !== qa.id))}
                aria-label={`ลบ ${qa.label}`}
                className="size-7 grid place-items-center rounded-md text-text-subtle hover:bg-red-bg hover:text-red transition-colors shrink-0"
              >
                <Trash2 size={14} strokeWidth={1.75} />
              </button>
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-3 flex flex-col gap-2.5">
          <div className="text-label text-text-subtle">เพิ่มปุ่มลัด</div>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ชื่อที่จะแสดง…" />
          <div className="flex gap-2">
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="flex-1 h-9 px-3 rounded-md border border-border-strong bg-surface text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <option value="">— ไม่ผูกกิจกรรม (งานทั่วไป) —</option>
              {ACTION_GROUPS.map((g) => (
                <optgroup key={g.group} label={g.group}>
                  {g.items.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <button
              onClick={() => setType(TASK_TYPE_ORDER[(TASK_TYPE_ORDER.indexOf(type) + 1) % TASK_TYPE_ORDER.length])}
              title="ประเภทงาน (แตะเพื่อเปลี่ยน)"
              className="shrink-0"
            >
              <Pill tone={TASK_TYPES[type].tone}>{TASK_TYPES[type].label}</Pill>
            </button>
          </div>
          <p className="text-label text-text-subtle">
            ผูกกิจกรรมไว้ = ติ๊กเสร็จแล้วระบบบันทึกกิจกรรมให้อัตโนมัติ (นับเข้า KPI)
          </p>
          <button
            onClick={add}
            className="h-9 rounded-md bg-accent text-text-onaccent font-medium hover:bg-accent-hover transition-colors"
          >
            เพิ่ม
          </button>
        </div>
      </div>
    </div>
  );
}

function TaskRow({
  task: t,
  onToggle,
  onEdit,
  onCycleType,
}: {
  task: Task;
  onToggle: () => void;
  onEdit: () => void;
  onCycleType: () => void;
}) {
  const target = getTarget(t.targetId);
  const repeats = t.repeat && t.repeat.freq !== "none";
  const hasMeta = !!(target || t.relatedLeadName || t.relatedListingId);
  return (
    <li className="flex items-start gap-3 px-4 py-2.5">
      <button
        onClick={onToggle}
        aria-label={t.done ? "ทำเครื่องหมายยังไม่เสร็จ" : "ทำเครื่องหมายเสร็จ"}
        className={cn(
          "mt-0.5 size-5 rounded-md border grid place-items-center shrink-0 transition-colors",
          t.done ? "bg-accent border-accent text-text-onaccent" : "border-border-strong hover:border-accent"
        )}
      >
        {t.done && (
          <svg viewBox="0 0 12 12" className="size-3" fill="none">
            <path d="M2.5 6.5l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      <div
        onClick={onEdit}
        className="min-w-0 flex-1 cursor-pointer"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onEdit()}
      >
        <div className="flex items-center gap-2">
          <span className={cn("text-body", t.done && "line-through text-text-subtle")}>{t.title}</span>
          {t.startTime && (
            <span className="inline-flex items-center gap-0.5 text-label text-text-subtle num shrink-0">
              <Clock size={11} strokeWidth={1.75} />
              {t.startTime}
              {t.endTime ? `–${t.endTime}` : ""}
            </span>
          )}
          {repeats && <Repeat size={11} strokeWidth={1.75} className="text-text-subtle shrink-0" />}
          {t.notes && <StickyNote size={11} strokeWidth={1.75} className="text-text-subtle shrink-0" />}
        </div>
        {hasMeta && (
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            {target && (
              <span className="inline-flex items-center gap-1 text-label text-text-subtle">
                <TargetIcon size={11} strokeWidth={1.75} /> {target.label}
              </span>
            )}
            {t.relatedLeadName && (
              <span className="inline-flex items-center gap-1 text-label text-violet">
                <UserRound size={11} strokeWidth={1.75} /> {t.relatedLeadName}
              </span>
            )}
            {t.relatedListingId && (
              <Link
                href={`/listings/${t.relatedListingId}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-label text-accent hover:underline"
              >
                <Building2 size={11} strokeWidth={1.75} /> {t.relatedListingName ?? t.relatedListingId}
              </Link>
            )}
          </div>
        )}
      </div>
      {/* Work-type badge — right-aligned, tap to cycle (สร้างยอด / พื้นฐาน / ส่วนตัว). */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onCycleType();
        }}
        title="ประเภทงาน (แตะเพื่อเปลี่ยน)"
        aria-label="ประเภทงาน"
        className="shrink-0 mt-0.5"
      >
        <Pill tone={TASK_TYPES[t.type].tone}>{TASK_TYPES[t.type].label}</Pill>
      </button>
    </li>
  );
}

// Awareness ratio: the split between สร้างยอด (accent) and พื้นฐาน (blue). ส่วนตัว is excluded
// from the ratio entirely (per design) — the bar answers "how much of my real work moves the
// number vs. keeps things running." Hidden when there are no build/พื้นฐาน tasks.
function TaskRatioBar({ tasks }: { tasks: Task[] }) {
  const b = tasks.filter((t) => t.type === "build").length;
  const w = tasks.filter((t) => t.type === "work").length;
  const denom = b + w;
  if (denom === 0) return null;
  const bPct = Math.round((b / denom) * 100);
  return (
    <div className="px-4 py-3 border-b border-border">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-small text-text-muted">สัดส่วนงาน</span>
        <span className="text-small text-text-muted">
          <span className="num font-bold text-accent">{bPct}%</span> สร้างยอด
        </span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden bg-surface-2">
        {b > 0 && <div className="bg-accent transition-all" style={{ width: `${(b / denom) * 100}%` }} />}
        {w > 0 && <div className="bg-blue transition-all" style={{ width: `${(w / denom) * 100}%` }} />}
      </div>
      <div className="flex gap-4 mt-2 text-small">
        <RatioLegend dot="bg-accent" label="สร้างยอด" n={b} />
        <RatioLegend dot="bg-blue" label="พื้นฐาน" n={w} />
      </div>
    </div>
  );
}

function RatioLegend({ dot, label, n }: { dot: string; label: string; n: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-text-muted">
      <span className={cn("size-2 rounded-full shrink-0", dot)} />
      {label} <span className="num text-text font-semibold">{n}</span>
    </span>
  );
}
