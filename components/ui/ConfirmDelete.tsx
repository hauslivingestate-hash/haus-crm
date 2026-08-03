"use client";

import * as React from "react";
import { Trash2, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";

/** Impact line for a delete confirm, from a usage count.
 *  count == null → usage isn't countable yet (e.g. the column isn't wired) — warn to check.
 *  Callers pass the entity noun ("ลีด", "ทรัพย์", "กิจกรรม"). */
export function usageWarning(count: number | null | undefined, noun = "รายการ"): string {
  if (count == null)
    return `ระบบยังไม่นับการใช้งานค่านี้ — โปรดตรวจสอบว่าไม่มี${noun}ที่ใช้ค่านี้อยู่ก่อนลบ`;
  if (count === 0) return `ไม่มี${noun}ที่ใช้ค่านี้ — ลบได้อย่างปลอดภัย`;
  return `มี ${count} ${noun}ที่ใช้ค่านี้อยู่ — ข้อมูลเดิมจะยังคงค่าเก่าไว้ แต่จะเลือกค่านี้ใหม่ไม่ได้อีก`;
}

/** Delete guard: clicking the trash opens a small anchored confirm popover that names the
 *  action AND its impact (via `warning`) before anything is deleted. Esc / outside click /
 *  ยกเลิก dismiss. (UI guard only — at wiring, deleting an in-use value must also be blocked
 *  server-side: reference-check → archive/disable instead of hard delete.) */
export function ConfirmDelete({
  onDelete,
  label = "ลบ",
  confirmLabel = "ยืนยันการลบ?",
  warning = "การลบไม่สามารถย้อนกลับได้",
  className,
}: {
  onDelete: () => void;
  /** aria-label/tooltip for the idle trash button. */
  label?: string;
  /** Popover title. */
  confirmLabel?: string;
  /** Impact line — what happens to data currently using this value. */
  warning?: React.ReactNode;
  className?: string;
}) {
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const close = React.useCallback(() => setRect(null), []);

  React.useEffect(() => {
    if (!rect) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [rect, close]);

  const width = 264;
  const left = rect ? Math.max(8, Math.min(rect.left - width + rect.width, window.innerWidth - width - 8)) : 0;
  const top = rect ? Math.min(rect.bottom + 4, window.innerHeight - 160) : 0;

  return (
    <>
      <button
        type="button"
        onClick={(e) => setRect(e.currentTarget.getBoundingClientRect())}
        aria-label={label}
        title={label}
        className={cn(
          "size-8 grid place-items-center rounded-md text-red hover:bg-red-bg transition-colors shrink-0",
          className
        )}
      >
        <Trash2 size={14} strokeWidth={1.75} />
      </button>

      {rect && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <div
            role="alertdialog"
            aria-label={typeof confirmLabel === "string" ? confirmLabel : "ยืนยันการลบ"}
            className="fixed z-50 rounded-lg border border-border bg-surface shadow-pop p-3 flex flex-col gap-2"
            style={{ left, top, width }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-body font-semibold">{confirmLabel}</div>
            <p className="text-small text-text-muted inline-flex items-start gap-1.5">
              <TriangleAlert size={13} strokeWidth={1.75} className="text-amber shrink-0 mt-0.5" />
              <span>{warning}</span>
            </p>
            <div className="flex items-center justify-end gap-2 mt-0.5">
              <button
                type="button"
                onClick={close}
                className="h-8 px-3 rounded-md text-small font-medium border border-border-strong text-text-muted hover:bg-surface-2 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => {
                  close();
                  onDelete();
                }}
                className="h-8 px-3 rounded-md text-small font-semibold bg-red text-white hover:opacity-90 transition-opacity"
              >
                ลบ
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
