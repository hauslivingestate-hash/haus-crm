"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X, Check, UserRound, Building2 } from "lucide-react";
import { Pill } from "@/components/ui/Pill";
import { TASK_TYPES, type Task } from "@/lib/momentum";
import { cn } from "@/lib/cn";

// Shown when a task carrying an `activityType` is ticked. This is what preserves the two
// things the deleted +บันทึก FAB could capture that a plain checkbox cannot:
//   • COUNT — a bulk tally ("Sourcing ×3", "Call ×12"), which new sales rely on
//   • REMARK — the note that lands on the entity timeline
// Everything else (which action, which lead/listing, which date) is already on the task, so
// this stays a two-field confirm rather than re-asking the whole FAB form.
//
// Tasks with no activityType never open this — they just tick.

const field =
  "w-full h-9 px-3 rounded-md border border-border-strong bg-surface text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

export function TaskCompleteSheet({
  task,
  onConfirm,
  onClose,
}: {
  task: Task | null;
  onConfirm: (count: number, remark: string) => void;
  onClose: () => void;
}) {
  const [count, setCount] = React.useState(1);
  const [remark, setRemark] = React.useState("");
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (task) {
      setCount(1);
      setRemark("");
    }
  }, [task]);

  React.useEffect(() => {
    if (!task) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [task, onClose]);

  if (!task || !mounted) return null;

  // A task tied to a specific lead/listing is one event; an unattached one is a tally, so
  // only the latter offers a count (mirrors the old FAB's rule).
  const attached = !!(task.relatedLeadId || task.relatedListingId);

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center"
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm(attached ? 1 : count, remark);
        }}
        className="w-full sm:max-w-sm bg-surface rounded-t-xl sm:rounded-xl border border-border shadow-pop p-5 flex flex-col gap-3.5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-label uppercase text-text-subtle">บันทึกกิจกรรม</div>
            <div className="text-body font-semibold truncate">{task.title}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="size-8 grid place-items-center rounded-md text-text-subtle hover:bg-surface-hover hover:text-text transition-colors shrink-0"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        {/* What will be written — read-only, taken from the task itself. */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill tone="accent">{task.activityType}</Pill>
          <Pill tone={TASK_TYPES[task.type].tone}>{TASK_TYPES[task.type].label}</Pill>
          {task.relatedLeadName && (
            <span className="inline-flex items-center gap-1 text-label text-violet">
              <UserRound size={11} strokeWidth={1.75} /> {task.relatedLeadName}
            </span>
          )}
          {task.relatedListingId && (
            <span className="inline-flex items-center gap-1 text-label text-accent">
              <Building2 size={11} strokeWidth={1.75} />{" "}
              {task.relatedListingName ?? task.relatedListingId}
            </span>
          )}
        </div>

        {!attached && (
          <label className="text-small text-text-muted flex flex-col gap-1.5">
            จำนวน
            <input
              type="number"
              min={1}
              max={50}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className={cn(field, "num w-28")}
            />
          </label>
        )}

        <label className="text-small text-text-muted flex flex-col gap-1.5">
          หมายเหตุ (ถ้ามี)
          <textarea
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="เกิดอะไรขึ้น…"
            rows={2}
            className={cn(field, "h-auto py-2 resize-none")}
          />
        </label>

        <button
          type="submit"
          className="h-10 rounded-md bg-accent text-text-onaccent font-medium hover:bg-accent-hover transition-colors inline-flex items-center justify-center gap-1.5"
        >
          <Check size={16} strokeWidth={2.25} /> เสร็จแล้ว · บันทึก
        </button>
      </form>
    </div>,
    document.body
  );
}
