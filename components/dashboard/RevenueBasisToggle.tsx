"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import { REVENUE_BASIS_LABEL, type RevenueBasis } from "@/lib/deals";

/* Close ⇄ Win — which date a deal's commission counts on.
 *
 * ── WHY IT LIVES IN THE URL, LIKE THE RANGE ─────────────────────────────────────
 * It scopes TWO server-rendered cards (เป้ารายได้ and แนวโน้มรายได้). React state in one
 * of them could not reach the other, and lifting it into a client wrapper would drag
 * both cards' queries into the browser. The URL is the only place both can read before
 * rendering — and it makes "our actual transferred revenue this quarter" a link someone
 * can paste to the CEO.
 *
 * ── IT IS NOT A FILTER, SO IT DOES NOT SIT WITH THE FILTERS ─────────────────────
 * The range bar narrows a window; this changes what the number MEANS. Two deals move
 * between months when it flips. So it sits on the revenue card itself, where the figure
 * it redefines is, rather than up in the filter row where it would look like another way
 * to slice the same total.
 */
export function RevenueBasisToggle({ active }: { active: RevenueBasis }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = React.useTransition();

  const go = (basis: RevenueBasis) => {
    const next = new URLSearchParams(params.toString());
    // "close" is the default, so it stays out of the URL — a shared link should carry
    // what someone chose, not restate what they left alone.
    if (basis === "close") next.delete("basis");
    else next.set("basis", basis);
    const qs = next.toString();
    startTransition(() =>
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    );
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md bg-surface-2 p-0.5 transition-opacity",
        pending && "opacity-60"
      )}
      aria-busy={pending}
    >
      {(["close", "win"] as const).map((b) => (
        <button
          key={b}
          type="button"
          onClick={() => go(b)}
          aria-pressed={active === b}
          title={b === "close" ? "นับจากวันเซ็นสัญญา (คาดการณ์)" : "นับจากวันโอน (รับจริง)"}
          className={cn(
            "h-6 rounded-[6px] px-2.5 text-small transition-colors",
            active === b ? "bg-surface text-text shadow-card" : "text-text-muted hover:text-text"
          )}
        >
          {REVENUE_BASIS_LABEL[b]}
        </button>
      ))}
    </div>
  );
}
