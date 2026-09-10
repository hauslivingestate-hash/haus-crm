"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Inbox, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { TASK_TYPES, TASK_TYPE_ORDER, type Task, type TaskType } from "@/lib/momentum";
import { createTask, deleteTask, scheduleTask } from "@/lib/mutations/tasks";
import type { PlanData } from "@/lib/plan";

/* รายการรอ — things you have decided to do and not decided when.
 *
 * ── WHY IT IS A CARD AND NOT A TAB ──────────────────────────────────────────────
 * Klaichan started it as a tab inside the plan and moved it out: "a backlog you have to
 * remember to open is a backlog you stop writing to." Out here the count is visible
 * without a tap, which is the only reason to keep one at all.
 *
 * ── AND WHY IT IS NOT JUST A TASK DATED TODAY ───────────────────────────────────
 * That was the shape before `tasks.task_date` became nullable, and it is what makes a
 * plan meaningless: every captured thought lands on today, the day fills with work nobody
 * intends to do, and the completion ring stops being a fact about the day. An undated row
 * is absent from every date filter for free — a NULL matches no range — so it cannot leak
 * into the plan or the calendar.
 *
 * ── SCHEDULING IS ONE COLUMN, NOT A COPY ────────────────────────────────────────
 * Picking a date moves the same row into the day: same id, same linked lead, same action
 * that fires when it is ticked, same audit trail. `scheduleTask` in lib/mutations/tasks.
 */
export function BacklogCard({ plan }: { plan: PlanData }) {
  const router = useRouter();
  const [draft, setDraft] = React.useState("");
  const [draftType, setDraftType] = React.useState<TaskType>("work");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Stay busy until the refresh lands, not just until the write returns — a second tap
  // fired into that gap would act on the list the previous render showed.
  const [refreshing, startRefresh] = React.useTransition();
  const busy = saving || refreshing;

  const run = async (fn: () => Promise<{ ok: true } | { ok: false; error: string } | { ok: true; task: Task }>) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fn();
      if (!res.ok) setError(res.error);
      else startRefresh(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  };

  const add = () => {
    const title = draft.trim();
    if (!title) return;
    setDraft("");
    void run(() => createTask({ title, date: null, type: draftType }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>รายการรอ</CardTitle>
        {plan.backlog.length > 0 && (
          <span
            title={`${plan.backlog.length} งานรอจัดวัน`}
            className="num rounded-md bg-accent-wash px-2 py-0.5 text-small font-semibold text-accent"
          >
            {plan.backlog.length}
          </span>
        )}
      </CardHeader>

      <CardContent>
        <p className="-mt-1 mb-2.5 text-small text-text-subtle">
          งานที่ยังไม่ลงวัน — เลือกวันเพื่อจัดลงแผน
        </p>

        {error && (
          <div className="mb-2.5 rounded-md bg-red-bg/50 px-3 py-2 text-small text-red">{error}</div>
        )}

        {plan.backlog.length === 0 ? (
          <div className="flex items-center gap-2.5 rounded-md bg-surface-2 px-3 py-2.5 text-small text-text-muted">
            <Inbox size={15} strokeWidth={1.75} className="shrink-0 text-text-subtle" />
            ว่าง — จดงานที่ยังไม่ได้จัดเวลาไว้ที่นี่
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {plan.backlog.map((t) => (
              <BacklogRow
                key={t.id}
                task={t}
                today={plan.today}
                busy={busy}
                onSchedule={(date) => void run(() => scheduleTask(t.id, date))}
                onDelete={() => void run(() => deleteTask(t.id))}
              />
            ))}
          </ul>
        )}

        <div className="mt-3 flex items-center gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder="จดไว้ก่อน ยังไม่ลงวัน…"
            disabled={busy}
            className="min-w-0 flex-1"
          />
          <button
            type="button"
            onClick={add}
            disabled={busy || !draft.trim()}
            aria-label="เพิ่มลงรายการรอ"
            className="grid size-8 shrink-0 place-items-center rounded-md bg-accent text-text-onaccent transition-colors hover:bg-accent-hover disabled:opacity-40"
          >
            <Plus size={16} strokeWidth={2} />
          </button>
        </div>

        {/* The type is chosen before adding rather than edited after: a captured thought
            with the wrong colour is still captured, and a second step to fix it is a step
            people skip. Defaults to งาน. */}
        <div className="mt-2 flex items-center gap-1">
          {TASK_TYPE_ORDER.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setDraftType(k)}
              aria-pressed={draftType === k}
              className={cn(
                "h-6 rounded-md px-2 text-label transition-colors",
                draftType === k ? "bg-surface-2 text-text" : "text-text-subtle hover:text-text"
              )}
            >
              {TASK_TYPES[k].label}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function BacklogRow({
  task,
  today,
  busy,
  onSchedule,
  onDelete,
}: {
  task: Task;
  today: string;
  busy: boolean;
  onSchedule: (date: string) => void;
  onDelete: () => void;
}) {
  const [picking, setPicking] = React.useState(false);

  return (
    <li className="group flex items-center gap-2 py-2">
      <span className={cn("size-1.5 shrink-0 rounded-full", DOT[task.type])} />
      <div className="min-w-0 flex-1">
        <span className="block truncate text-body text-text">{task.title}</span>
        {(task.relatedLeadName || task.relatedListingName) && (
          <span className="block truncate text-label text-text-subtle">
            {task.relatedLeadName ?? task.relatedListingName}
          </span>
        )}
      </div>

      {picking ? (
        // A native date input, not a calendar popover. It is one field, it is already
        // localised, and on a phone it opens the OS picker — which is better than anything
        // worth building for a control used once per captured task.
        <input
          type="date"
          autoFocus
          min={today}
          disabled={busy}
          onChange={(e) => {
            if (e.target.value) onSchedule(e.target.value);
            setPicking(false);
          }}
          onBlur={() => setPicking(false)}
          className="num h-7 shrink-0 rounded-md border border-border-strong bg-surface px-1.5 text-small"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPicking(true)}
          disabled={busy}
          title="เลือกวันแล้วจัดลงแผน"
          aria-label={`จัดวันให้ ${task.title}`}
          className="grid size-7 shrink-0 place-items-center rounded-md text-accent transition-colors hover:bg-accent-wash disabled:opacity-40"
        >
          <CalendarPlus size={15} strokeWidth={1.75} />
        </button>
      )}

      <button
        type="button"
        onClick={onDelete}
        disabled={busy}
        aria-label={`ลบ ${task.title}`}
        className="grid size-7 shrink-0 place-items-center rounded-md text-text-subtle opacity-0 transition-all hover:bg-red-bg hover:text-red focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-40"
      >
        <Trash2 size={14} strokeWidth={1.75} />
      </button>
    </li>
  );
}

const DOT: Record<TaskType, string> = {
  build: "bg-accent",
  work: "bg-dot-blue",
  personal: "bg-dot-violet",
};
