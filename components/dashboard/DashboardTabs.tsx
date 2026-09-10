"use client";

/* The dashboard's tab strip — one tab per kind of job (see lib/dashboardTabs.ts).
 *
 * Underline tabs, NOT the pill segmented control the range filter uses. The two sit
 * within 40px of each other and do different things: one switches which dashboard you
 * are reading, the other narrows the period inside it. Giving them the same shape is
 * how a person taps the wrong one.
 *
 * The selection lives in `?tab=` for the same reason the range does — the page is a
 * server component and has to know which dashboard to query before rendering.
 */

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import type { DashboardTab } from "@/lib/dashboardTabs";

export function DashboardTabs({ tabs, active }: { tabs: DashboardTab[]; active: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = React.useTransition();

  // One tab is not a choice, and a strip that offers none is furniture. The server also
  // checks this, so nothing renders an empty bar if the registry grows a gap.
  if (tabs.length < 2) return null;

  const go = (id: string) => {
    const next = new URLSearchParams(params.toString());
    next.set("tab", id);
    // The range is deliberately KEPT across a tab switch: "เดือนนี้" means the same
    // thing on every dashboard, and re-picking it each time is friction with no payoff.
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  return (
    <div
      className={cn(
        "flex items-stretch gap-1 overflow-x-auto border-b border-border px-4 lg:px-6 transition-opacity",
        pending && "opacity-60"
      )}
      role="tablist"
      aria-busy={pending}
    >
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => go(t.id)}
            className={cn(
              "h-11 shrink-0 whitespace-nowrap border-b-2 px-3 -mb-px text-body transition-colors",
              on
                ? "border-accent text-text font-medium"
                : "border-transparent text-text-muted hover:text-text"
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
