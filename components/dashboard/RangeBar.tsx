"use client";

/* The dashboard's time filter, as a segmented control plus a custom window.
 *
 * Ported from Klaichan CRM, restyled onto this repo's tokens — the same control as
 * components/ui/Segmented.tsx, which it deliberately does NOT reuse: that one owns its
 * selection in React state, and this one's selection lives in the URL so the server can
 * read it before rendering.
 *
 * ── WHY IT IS OPTIMISTIC RATHER THAN INSTANT ────────────────────────────────────
 * Tapping a preset rewrites the URL and the server re-renders with new SQL. The numbers
 * therefore arrive a moment after the button moves. `useTransition` dims the whole bar
 * while that is in flight, because a segmented control that snaps while the figures
 * below it still show the old period reads as broken.
 */

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarRange, Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { todayISO } from "@/lib/momentum";
import { RANGE_PRESETS, rangeParams, shortDate, type RangeKey } from "@/lib/range";
import { useTopmostEscape } from "@/lib/overlayStack";

export function RangeBar({ active, from, to }: { active: RangeKey; from?: string; to?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = React.useTransition();

  const go = (key: RangeKey, a?: string, b?: string) => {
    // Preserve every other param on the page — the tab, above all. A range change must
    // never bounce a leader back to the first dashboard they can see.
    const next = new URLSearchParams(params.toString());
    next.delete("range");
    next.delete("from");
    next.delete("to");
    const own = new URLSearchParams(rangeParams(key, a, b).replace(/^\?/, ""));
    own.forEach((v, k) => next.set(k, v));
    const qs = next.toString();
    // scroll:false — the bar is sticky and the cards sit below it. Jumping to the top on
    // every tap would hide the very numbers that just changed.
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  return (
    <div
      className={cn("flex flex-wrap items-center gap-2 transition-opacity", pending && "opacity-60")}
      aria-busy={pending}
    >
      <div className="inline-flex items-center gap-0.5 bg-surface-2 rounded-md p-0.5">
        {RANGE_PRESETS.map((r) => {
          const on = r.key === active;
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => go(r.key)}
              aria-pressed={on}
              className={cn(
                "h-7 px-3 rounded-[7px] text-small transition-colors",
                on ? "bg-surface text-text shadow-card" : "text-text-muted hover:text-text"
              )}
            >
              {r.label}
            </button>
          );
        })}
      </div>
      <CustomRange active={active === "custom"} from={from} to={to} onPick={(a, b) => go("custom", a, b)} />
    </div>
  );
}

function CustomRange({
  active,
  from,
  to,
  onPick,
}: {
  active: boolean;
  from?: string;
  to?: string;
  onPick: (a: string, b: string) => void;
}) {
  const today = todayISO();
  const [open, setOpen] = React.useState(false);
  const [a, setA] = React.useState(from ?? "");
  const [b, setB] = React.useState(to ?? today);

  useTopmostEscape(() => setOpen(false), open);

  const valid = !!a && !!b && a <= b;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-1.5 h-7 px-3 rounded-md text-small transition-colors",
          active
            ? "bg-accent text-text-onaccent"
            : "bg-surface-2 text-text-muted hover:text-text"
        )}
      >
        <CalendarRange size={13} strokeWidth={1.75} />
        {active && from && to ? `${shortDate(from)} – ${shortDate(to)}` : "กำหนดเอง"}
      </button>

      {open && (
        <>
          {/* A full-screen backdrop rather than a document click listener: on touch, an
              outside-click handler fights the scroll gesture. */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 rounded-lg border border-border bg-surface p-4 shadow-pop">
            <div className="text-small text-text-muted">เลือกช่วงวันที่</div>
            <div className="mt-3 flex flex-col gap-2">
              <label className="flex items-center gap-2 text-small text-text-muted">
                <span className="w-8 shrink-0">จาก</span>
                <input
                  type="date"
                  value={a}
                  max={today}
                  onChange={(e) => setA(e.target.value)}
                  className="num min-w-0 flex-1 rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-small text-text outline-none focus:border-accent"
                />
              </label>
              <label className="flex items-center gap-2 text-small text-text-muted">
                <span className="w-8 shrink-0">ถึง</span>
                <input
                  type="date"
                  value={b}
                  max={today}
                  onChange={(e) => setB(e.target.value)}
                  className="num min-w-0 flex-1 rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-small text-text outline-none focus:border-accent"
                />
              </label>
            </div>
            <button
              type="button"
              disabled={!valid}
              onClick={() => {
                onPick(a, b);
                setOpen(false);
              }}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md bg-accent py-2 text-small font-medium text-text-onaccent transition-colors hover:bg-accent-hover disabled:opacity-40"
            >
              <Check size={14} strokeWidth={2} /> ใช้ช่วงนี้
            </button>
            <p className="mt-2 text-small text-text-subtle leading-snug">
              ช่วงกำหนดเองไม่มีช่วงก่อนหน้าให้เทียบ — ตัวเลขเปรียบเทียบจะถูกซ่อนไว้
            </p>
          </div>
        </>
      )}
    </div>
  );
}
