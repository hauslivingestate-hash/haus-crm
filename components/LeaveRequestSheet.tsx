"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X, Check, CalendarOff } from "lucide-react";
import { useLeave } from "@/components/LeaveProvider";
import { LEAVE_TYPES, leaveDays } from "@/lib/leave";
import { TODAY } from "@/lib/momentum";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";

// ขอลา — filed from แผนวันนี้, because that is where people already plan their days.
// Lands as `pending`; HR decides on /leave.
//
// Defaults to the day the user is currently looking at in the plan, so "I want off this
// day" is two taps. Single-day is the common case (most rows in the source sheet are one
// day), so end date auto-follows start until the user changes it.

const field =
  "w-full h-9 px-3 rounded-md border border-border-strong bg-surface text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

export function LeaveRequestSheet({
  open,
  defaultDate,
  employeeId,
  nickname,
  onClose,
}: {
  open: boolean;
  defaultDate: string;
  /** Who the request is filed FOR. Passed in rather than read from the session so this
   *  matches whoever owns the plan the button was pressed on — otherwise the banner and the
   *  submission could disagree while `/today` is still hardcoded to SAMPLE_AGENT. */
  employeeId: string;
  nickname: string;
  onClose: () => void;
}) {
  const { submit } = useLeave();
  const [start, setStart] = React.useState(defaultDate);
  const [end, setEnd] = React.useState(defaultDate);
  const [type, setType] = React.useState(LEAVE_TYPES[0]);
  const [remark, setRemark] = React.useState("");
  const [done, setDone] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (open) {
      setStart(defaultDate);
      setEnd(defaultDate);
      setType(LEAVE_TYPES[0]);
      setRemark("");
      setDone(false);
    }
  }, [open, defaultDate]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  // The source sheet contains a row whose end date precedes its start (a real data error).
  // Block it here rather than inherit the problem.
  const invalidRange = end < start;
  const days = invalidRange ? 0 : leaveDays({ startDate: start, endDate: end });

  function onStartChange(v: string) {
    setStart(v);
    // Keep single-day requests effortless: drag the end along until it's set independently.
    if (end < v) setEnd(v);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (invalidRange) return;
    submit({
      employeeId,
      nickname,
      submittedAt: TODAY,
      startDate: start,
      endDate: end,
      type,
      remark: remark.trim() || null,
    });
    setDone(true);
  }

  return createPortal(
    <div onClick={onClose} className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center">
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={onSubmit}
        className="w-full sm:max-w-sm bg-surface rounded-t-xl sm:rounded-xl border border-border shadow-pop p-5 flex flex-col gap-3.5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="inline-flex items-center gap-2">
            <CalendarOff size={18} strokeWidth={1.75} className="text-accent" />
            <div className="text-h3">ขอลา</div>
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

        {done ? (
          <>
            <div className="rounded-md px-3 py-2.5 text-small border bg-green-bg text-green border-green/30 inline-flex items-center gap-1.5">
              <Check size={14} strokeWidth={2} /> ส่งใบลาแล้ว · รออนุมัติ
            </div>
            <p className="text-small text-text-muted">
              {formatDate(start)}
              {end !== start && ` – ${formatDate(end)}`} · {type} ·{" "}
              <span className="num">{days}</span> วัน
            </p>
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-md bg-accent text-text-onaccent font-medium hover:bg-accent-hover transition-colors"
            >
              เสร็จสิ้น
            </button>
          </>
        ) : (
          <>
            <div className="flex gap-3">
              <label className="flex-1 text-small text-text-muted flex flex-col gap-1.5">
                วันเริ่ม
                <input type="date" value={start} onChange={(e) => onStartChange(e.target.value)} className={field} />
              </label>
              <label className="flex-1 text-small text-text-muted flex flex-col gap-1.5">
                วันสุดท้าย
                <input
                  type="date"
                  value={end}
                  min={start}
                  onChange={(e) => setEnd(e.target.value)}
                  className={cn(field, invalidRange && "border-red")}
                />
              </label>
            </div>

            {invalidRange ? (
              <p className="text-small text-red">วันสุดท้ายต้องไม่ก่อนวันเริ่ม</p>
            ) : (
              <p className="text-small text-text-muted">
                รวม <span className="num font-semibold text-text">{days}</span> วัน
              </p>
            )}

            <label className="text-small text-text-muted flex flex-col gap-1.5">
              ประเภทการลา
              <select value={type} onChange={(e) => setType(e.target.value)} className={field}>
                {LEAVE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>

            <label className="text-small text-text-muted flex flex-col gap-1.5">
              เหตุผล (ถ้ามี)
              <textarea
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                rows={2}
                placeholder="เช่น กลับต่างจังหวัด"
                className={cn(field, "h-auto py-2 resize-none")}
              />
            </label>

            <button
              type="submit"
              disabled={invalidRange}
              className="h-10 rounded-md bg-accent text-text-onaccent font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:pointer-events-none"
            >
              ส่งใบลา
            </button>
          </>
        )}
      </form>
    </div>,
    document.body
  );
}
