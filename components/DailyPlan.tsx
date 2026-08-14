"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { useLeave } from "@/components/LeaveProvider";
import { LeaveRequestSheet } from "@/components/LeaveRequestSheet";
import { coversDate } from "@/lib/leave";
import { useRbac } from "@/components/RbacProvider";
import { DEFAULT_QUICK_ACTIONS, type QuickAction } from "@/lib/quickAdd";
import { formatDate } from "@/lib/format";
import type { PlanData } from "@/lib/plan";
import {
  createTask,
  updateTask,
  deleteTask as deleteTaskAction,
  setTaskDone,
  fetchTasksInRange,
  saveQuickActions,
} from "@/lib/mutations/tasks";
import {
  addDays,
  monthBounds,
  monthOf,
  TASK_TYPES,
  TASK_TYPE_ORDER,
  type Task,
  type TaskType,
} from "@/lib/momentum";
import { cn } from "@/lib/cn";

function relLabel(iso: string, today: string): string | null {
  if (iso === today) return "วันนี้";
  if (iso === addDays(today, 1)) return "พรุ่งนี้";
  if (iso === addDays(today, -1)) return "เมื่อวาน";
  return null;
}

export function DailyPlan({ plan }: { plan: PlanData }) {
  const router = useRouter();
  const [date, setDate] = React.useState(plan.today);
  const [draft, setDraft] = React.useState("");
  const [draftType, setDraftType] = React.useState<TaskType>("work");
  const [sheet, setSheet] = React.useState<{ open: boolean; task: Task | null }>({
    open: false,
    task: null,
  });
  const [calOpen, setCalOpen] = React.useState(false);
  const [completing, setCompleting] = React.useState<Task | null>(null);
  const [quickEdit, setQuickEdit] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // The write finishing is not the same as the screen being right again: router.refresh()
  // lands later. Ticking a task in that gap acts on the PREVIOUS render — which is how a
  // task that had just been linked to an action got ticked without the confirm sheet, and
  // its count/remark were silently defaulted. Staying busy until the refresh lands closes it.
  const [refreshing, startRefresh] = React.useTransition();
  const busy = saving || refreshing;

  // The page ships one month (± a day). Any other month the user browses to is fetched on
  // demand and cached here; rows inside the shipped range are dropped from it so the server
  // copy always wins and a deleted task can't linger in the overlap.
  const [extra, setExtra] = React.useState<Record<string, Task[]>>({});
  const serverRange = React.useMemo(() => {
    const { from, to } = monthBounds(plan.month);
    return { from: addDays(from, -1), to: addDays(to, 1) };
  }, [plan.month]);

  const viewMonth = monthOf(date);

  React.useEffect(() => {
    if (viewMonth === plan.month || extra[viewMonth]) return;
    let cancelled = false;
    const { from, to } = monthBounds(viewMonth);
    fetchTasksInRange(from, to).then((rows) => {
      if (!cancelled) setExtra((e) => ({ ...e, [viewMonth]: rows }));
    });
    return () => {
      cancelled = true;
    };
  }, [viewMonth, plan.month, extra]);

  const tasks = React.useMemo(() => {
    const outside = Object.values(extra)
      .flat()
      .filter((t) => t.date < serverRange.from || t.date > serverRange.to);
    return [...plan.tasks, ...outside];
  }, [plan.tasks, extra, serverRange]);

  // Optimistic tick state. The server action + router.refresh() is the source of truth; this
  // only stops the checkbox from lagging a round-trip behind the click. Cleared whenever
  // fresh server data arrives.
  const [doneOverride, setDoneOverride] = React.useState<Record<number, boolean>>({});
  React.useEffect(() => setDoneOverride({}), [plan.tasks]);
  const isDone = (t: Task) => doneOverride[t.id] ?? t.done;

  // ⚠️ IDENTITY: this screen belongs to ONE person — the signed-in employee. Tasks, logged
  // activity, Quick Add presets and now leave are all keyed on `plan.employeeCode`.
  const { can } = useRbac();
  const { requests } = useLeave();
  const [leaveOpen, setLeaveOpen] = React.useState(false);
  const myLeaveToday = requests.find(
    (r) => r.employeeId === plan.employeeCode && coversDate(r, date)
  );

  // Someone who has never customised their presets gets the starter set. Tapping one still
  // creates a real task — the chips only need saving once they're edited.
  const quick: QuickAction[] = React.useMemo(
    () =>
      plan.quickActions.length
        ? plan.quickActions.map((q) => ({
            id: `qa_${q.id}`,
            label: q.label,
            type: q.type,
            activityType: q.activityType,
          }))
        : DEFAULT_QUICK_ACTIONS,
    [plan.quickActions]
  );

  const dayTasks = tasks
    .filter((t) => t.date === date)
    .sort((a, b) => a.order - b.order);
  const doneCount = dayTasks.filter(isDone).length;
  const pct = dayTasks.length ? Math.round((doneCount / dayTasks.length) * 100) : 0;

  /** After any write: refresh the server month, and re-fetch the browsed month if it isn't it. */
  const syncAfterWrite = React.useCallback(async () => {
    if (viewMonth !== plan.month) {
      const { from, to } = monthBounds(viewMonth);
      const rows = await fetchTasksInRange(from, to);
      setExtra((e) => ({ ...e, [viewMonth]: rows }));
    }
    startRefresh(() => router.refresh());
  }, [viewMonth, plan.month, router]);

  /** Every write funnels through here so busy/error handling is identical everywhere.
   *
   *  The try/catch is not defensive padding: a server action can REJECT rather than return
   *  `{ok:false}` — a dropped connection, or a navigation that aborts the request. Without
   *  it the rejection is swallowed by the `void run(...)` call sites, the optimistic tick
   *  stays on screen, and the plan quietly claims work was logged that never reached the DB. */
  const run = React.useCallback(
    async (fn: () => Promise<{ ok: true } | { ok: false; error: string } | { ok: true; task: Task }>) => {
      setSaving(true);
      setError(null);
      try {
        const res = await fn();
        if (!res.ok) setError(res.error);
        else await syncAfterWrite();
        return res.ok;
      } catch (e) {
        setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [syncAfterWrite]
  );

  // ── Task → activity bridge ────────────────────────────────────────────────
  // Completing a task carrying an `activityType` WRITES an `activities` row. Since the
  // +บันทึก FAB was removed (CEO feedback R1), this is the only path by which activity
  // reaches the KPI targets, the new-sales rank ladder, and the entity timelines.
  //
  // Tick a linked task → confirm sheet (count + remark) → log. Untick → the row is deleted
  // server-side, so a mis-tick doesn't leave a phantom activity behind. Unlinked tasks just
  // tick. `canLog` mirrors the same `activity.log` check the server action re-runs.
  const canLog = plan.canLog;

  const toggle = async (t: Task) => {
    const currentlyDone = isDone(t);
    if (!currentlyDone && t.activityType && canLog) {
      setCompleting(t);
      return;
    }
    setDoneOverride((o) => ({ ...o, [t.id]: !currentlyDone }));
    const ok = await run(() => setTaskDone(t.id, !currentlyDone));
    if (!ok) setDoneOverride((o) => ({ ...o, [t.id]: currentlyDone }));
  };

  const confirmComplete = async (count: number, remark: string) => {
    const t = completing;
    if (!t) return;
    setCompleting(null);
    setDoneOverride((o) => ({ ...o, [t.id]: true }));
    const ok = await run(() => setTaskDone(t.id, true, { count, remark }));
    if (!ok) setDoneOverride((o) => ({ ...o, [t.id]: false }));
  };

  const cycleType = (t: Task) => {
    const next = TASK_TYPE_ORDER[(TASK_TYPE_ORDER.indexOf(t.type) + 1) % TASK_TYPE_ORDER.length];
    void run(() => updateTask(t.id, { ...toInput(t), type: next }));
  };

  const add = () => {
    const title = draft.trim();
    if (!title) return;
    setDraft("");
    void run(() => createTask({ title, date, type: draftType }));
  };

  const cycleDraftType = () =>
    setDraftType((t) => TASK_TYPE_ORDER[(TASK_TYPE_ORDER.indexOf(t) + 1) % TASK_TYPE_ORDER.length]);

  /** Quick Add — appends an UNTICKED task. It's a plan, not a log: the tick is what
   *  records the activity. Time / notes / linked entity get filled in afterwards. */
  const addQuick = (qa: QuickAction) =>
    void run(() =>
      createTask({ title: qa.label, date, type: qa.type, activityType: qa.activityType ?? null })
    );

  // Advanced add / edit via the detail sheet. Keeping a completed task's logged activity in
  // sync with the edit is handled server-side by `updateTask`.
  const applyDraft = (d: TaskDraft) => {
    if (sheet.task) {
      // Capture id AND date now: the sheet calls onClose() right after onSubmit(), which
      // nulls `sheet.task` before the async write runs.
      const { id, date: taskDate } = sheet.task;
      void run(() => updateTask(id, { ...d, date: taskDate }));
    } else {
      void run(() => createTask({ ...d, date }));
    }
  };

  const removeTask = () => {
    if (!sheet.task) return;
    const id = sheet.task.id;
    void run(() => deleteTaskAction(id));
  };

  const applyQuick = (next: QuickAction[]) =>
    void run(() =>
      saveQuickActions(
        next.map((q) => ({ label: q.label, type: q.type, activityType: q.activityType ?? null }))
      )
    );

  const rel = relLabel(date, plan.today);

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
          {date !== plan.today && (
            <button
              onClick={() => setDate(plan.today)}
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
                  today={plan.today}
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
            {/* Every LEAVE_TYPES entry except อื่นๆ already starts with "ลา", so prefixing
                another one gives "คุณลาลาป่วยวันนี้". */}
            <span className="text-text">
              คุณ{myLeaveToday.type.startsWith("ลา") ? "" : "ลา"}
              {myLeaveToday.type}วันนี้
            </span>
            <Pill tone={myLeaveToday.status === "approved" ? "green" : "amber"}>
              {myLeaveToday.status === "approved" ? "อนุมัติแล้ว" : "รออนุมัติ"}
            </Pill>
          </div>
        )}

        {error && (
          <div className="px-4 py-2.5 border-b border-border bg-red-bg/50 text-small text-red">
            {error}
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
              done={isDone(t)}
              targetLabel={plan.targets.find((g) => g.id === t.targetId)?.label}
              busy={busy}
              onToggle={() => void toggle(t)}
              onEdit={() => setSheet({ open: true, task: t })}
              onCycleType={() => cycleType(t)}
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
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-full border border-border-strong px-2.5 py-1 text-small text-text-muted hover:border-accent hover:text-accent transition-colors disabled:opacity-50"
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
            disabled={busy}
            aria-label="เพิ่มงาน"
            className="size-8 grid place-items-center rounded-md bg-accent text-text-onaccent hover:bg-accent-hover transition-colors shrink-0 disabled:opacity-50"
          >
            <Plus size={16} strokeWidth={2} />
          </button>
        </div>
      </CardContent>

      <TaskDetailSheet
        open={sheet.open}
        mode={sheet.task ? "edit" : "add"}
        initial={sheet.task}
        targets={plan.targets}
        actionGroups={plan.actionGroups}
        onSubmit={applyDraft}
        onDelete={removeTask}
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
          actionGroups={plan.actionGroups}
          onChange={applyQuick}
          onClose={() => setQuickEdit(false)}
        />
      )}

      {/* ขอลา — defaults to the date currently shown in the plan. */}
      <LeaveRequestSheet
        open={leaveOpen}
        defaultDate={date}
        onClose={() => setLeaveOpen(false)}
      />
    </Card>
  );
}

/** A task, back in the shape the update action takes. */
function toInput(t: Task) {
  return {
    title: t.title,
    date: t.date,
    type: t.type,
    notes: t.notes ?? null,
    targetId: t.targetId ?? null,
    activityType: t.activityType ?? null,
    relatedLeadId: t.relatedLeadId ?? null,
    relatedListingId: t.relatedListingId ?? null,
    startTime: t.startTime ?? null,
    endTime: t.endTime ?? null,
    repeatFreq: t.repeat?.freq ?? null,
    repeatWeekdays: t.repeat?.weekdays ?? null,
    repeatDayOfMonth: t.repeat?.dayOfMonth ?? null,
  };
}

// ── Quick Add editor ─────────────────────────────────────────────────────────
// Per-user preference, so it lives here rather than in company Settings. Adding a chip
// picks an action from the SAME catalog the activity log uses (`action_type`, loaded from
// the DB) — a chip bound to an action logs it on completion; one without is a plain to-do.
function QuickActionsEditor({
  actions,
  actionGroups,
  onChange,
  onClose,
}: {
  actions: QuickAction[];
  actionGroups: PlanData["actionGroups"];
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
      { id: `qa_new_${actions.length}`, label: l, type, activityType: action || undefined },
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
              {actionGroups.map((g) => (
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
  done,
  targetLabel,
  busy,
  onToggle,
  onEdit,
  onCycleType,
}: {
  task: Task;
  done: boolean;
  targetLabel?: string;
  busy: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onCycleType: () => void;
}) {
  const repeats = t.repeat && t.repeat.freq !== "none";
  const hasMeta = !!(targetLabel || t.relatedLeadName || t.relatedListingId);
  return (
    <li className="flex items-start gap-3 px-4 py-2.5">
      <button
        onClick={onToggle}
        disabled={busy}
        aria-label={done ? "ทำเครื่องหมายยังไม่เสร็จ" : "ทำเครื่องหมายเสร็จ"}
        className={cn(
          "mt-0.5 size-5 rounded-md border grid place-items-center shrink-0 transition-colors disabled:opacity-60",
          done ? "bg-accent border-accent text-text-onaccent" : "border-border-strong hover:border-accent"
        )}
      >
        {done && (
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
          <span className={cn("text-body", done && "line-through text-text-subtle")}>{t.title}</span>
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
            {targetLabel && (
              <span className="inline-flex items-center gap-1 text-label text-text-subtle">
                <TargetIcon size={11} strokeWidth={1.75} /> {targetLabel}
              </span>
            )}
            {t.relatedLeadName && (
              <Link
                href={`/leads/${t.relatedLeadId}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-label text-violet hover:underline"
              >
                <UserRound size={11} strokeWidth={1.75} /> {t.relatedLeadName}
              </Link>
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
        disabled={busy}
        title="ประเภทงาน (แตะเพื่อเปลี่ยน)"
        aria-label="ประเภทงาน"
        className="shrink-0 mt-0.5 disabled:opacity-60"
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
