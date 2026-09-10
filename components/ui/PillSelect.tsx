"use client";

/* One-tap choice. Every option is on screen; tapping one saves it.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────────
 * Moving a lead from ติดตาม to นัดหมาย used to take five actions: open แก้ไข, find the
 * dropdown, open it, pick, save. Five actions is enough friction that the board stops
 * being updated, and a stale board is worse than no board — it is a board people have
 * learned to distrust. This is one tap.
 *
 * ── OPTIMISTIC, WITH A REAL UNDO ────────────────────────────────────────────────
 * The pill moves the instant it is tapped, before the server answers, because the whole
 * point is that it feels like flipping a switch. If the write fails the value snaps back
 * to what it was and the error is shown — never left showing the value the user picked
 * while the database holds a different one.
 *
 * ── THE CURRENT VALUE IS ALWAYS OFFERED ─────────────────────────────────────────
 * Callers pass the full vocabulary. If a lead holds a value that is no longer in the list
 * (renamed in Settings, imported from the sheet) the caller should append it — otherwise
 * the pills silently show nothing selected, and the first tap anywhere overwrites a value
 * the user could not see.
 *
 * ── SOME TAPS ASK FIRST ─────────────────────────────────────────────────────────
 * One tap is right for a lead moving down the pipeline: the wrong pill is undone by
 * tapping the right one, and every change is in the audit log. It is NOT right for the
 * handful of values that END something — a deal marked won, a lead marked lost, a listing
 * marked sold. Those are statements about the outcome, they feed the revenue figures, and
 * a fat finger on a phone should not be able to make one silently.
 *
 * So `confirm` lets the caller mark those values, and only those: return a warning and the
 * tap opens a small confirm anchored to the pill; return null and it saves instantly as
 * before. Guarding every pill would just teach everyone to click through the box.
 */

import * as React from "react";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import { useTopmostEscape } from "@/lib/overlayStack";
import { cn } from "@/lib/cn";

export interface PillOption<T extends string> {
  value: T;
  label: string;
  /** Tailwind bg-* token for the leading dot, e.g. "bg-dot-blue". */
  dot?: string;
}

export function PillSelect<T extends string>({
  value,
  options,
  onChange,
  disabled,
  size = "md",
  "aria-label": ariaLabel,
}: {
  value: T | null;
  options: PillOption<T>[];
  /** Resolves to an error message, or null when the write succeeded. */
  onChange: (next: T) => Promise<string | null>;
  /** Return a warning to make this value ask before it saves; null/undefined saves at once.
      Reserve it for values that end something — see the header. */
  confirm?: (next: T) => React.ReactNode | null;
  disabled?: boolean;
  size?: "sm" | "md";
  "aria-label"?: string;
}) {
  const [optimistic, setOptimistic] = React.useState<T | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  /** The tap waiting to be confirmed, with the pill it came from so the box can point at it. */
  const [pending, setPending] = React.useState<
    { value: T; label: string; warning: React.ReactNode; rect: DOMRect } | null
  >(null);

  // Server value wins whenever it changes — a revalidation, or an edit made elsewhere.
  React.useEffect(() => setOptimistic(null), [value]);

  const shown = optimistic ?? value;
  const dismiss = React.useCallback(() => setPending(null), []);

  /* Escape belongs to the topmost overlay, and this box can open inside the detail drawer.
     A bare listener here would cancel the confirm AND close the drawer behind it. */
  useTopmostEscape(dismiss, !!pending);

  // The box is anchored to a pill in a scrolling panel, so it cannot follow it. Anything
  // that would move it out from under the pill closes it instead of lying about what it
  // is asking to change.
  React.useEffect(() => {
    if (!pending) return;
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [pending, dismiss]);

  async function apply(next: T) {
    setOptimistic(next);
    setBusy(true);
    setError(null);
    const err = await onChange(next);
    setBusy(false);
    if (err) {
      setOptimistic(null); // back to what the server still holds
      setError(err);
    }
  }

  function pick(next: T, el: HTMLElement, label: string) {
    if (next === shown || busy) return;
    const warning = confirm?.(next);
    if (warning) {
      setError(null);
      setPending({ value: next, label, warning, rect: el.getBoundingClientRect() });
      return;
    }
    void apply(next);
  }

  const width = 268;
  const left = pending
    ? Math.max(8, Math.min(pending.rect.left, window.innerWidth - width - 8))
    : 0;
  const top = pending ? Math.min(pending.rect.bottom + 6, window.innerHeight - 170) : 0;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1" role="group" aria-label={ariaLabel}>
        {options.map((o) => {
          const active = o.value === shown;
          return (
            <button
              key={o.value}
              type="button"
              disabled={disabled || busy}
              aria-pressed={active}
              onClick={(e) => pick(o.value, e.currentTarget, o.label)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full font-medium transition-colors",
                "disabled:cursor-not-allowed disabled:opacity-60",
                size === "sm" ? "px-2.5 py-1 text-label" : "px-3 py-1.5 text-small",
                active
                  ? "bg-accent text-text-onaccent"
                  : "bg-surface-2 text-text-muted hover:bg-surface-3 hover:text-text"
              )}
            >
              {o.dot && (
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    active ? "bg-text-onaccent" : o.dot
                  )}
                />
              )}
              {o.label}
            </button>
          );
        })}
        {busy && <LoaderCircle size={13} className="animate-spin text-text-subtle" />}
      </div>
      {error && <p className="mt-1.5 text-label text-red">{error}</p>}

      {/* Same shape as ConfirmDelete: name the change, say what it causes, then offer it.
          Fixed rather than absolute so a pill near the bottom of a scrolling drawer does
          not open a box that is clipped off. */}
      {pending && (
        <>
          <div className="fixed inset-0 z-40" onClick={dismiss} />
          <div
            role="alertdialog"
            aria-label={`เปลี่ยนเป็น ${pending.label}?`}
            className="fixed z-50 flex flex-col gap-2 rounded-lg border border-border bg-surface p-3 shadow-pop"
            style={{ left, top, width }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-body font-semibold">
              เปลี่ยนเป็น “{pending.label}”?
            </div>
            <p className="inline-flex items-start gap-1.5 text-small text-text-muted">
              <TriangleAlert size={13} strokeWidth={1.75} className="mt-0.5 shrink-0 text-amber" />
              <span>{pending.warning}</span>
            </p>
            <div className="mt-0.5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={dismiss}
                className="h-8 rounded-md border border-border-strong px-3 text-small font-medium text-text-muted transition-colors hover:bg-surface-2"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => {
                  const next = pending.value;
                  setPending(null);
                  void apply(next);
                }}
                className="h-8 rounded-md bg-accent px-3 text-small font-semibold text-text-onaccent transition-colors hover:bg-accent-hover"
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
