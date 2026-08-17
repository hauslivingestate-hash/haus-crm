"use client";

import * as React from "react";
import type { Activity } from "@/lib/actions";

// The activity log, read from the `activities` table.
//
// Phase 6: this was an in-memory store seeded from a dozen sample rows, while the table held
// 2,334 real ones. Ticking a task on แผนวันนี้ has written to the table directly since
// Phase 5 (lib/mutations/tasks.ts) — so the store had stopped being where the writes went,
// and was only ever showing the seed.
//
// It is a plain read-through now: the layout server-renders the feed and router.refresh()
// after a write brings the new rows down. No `logActivity` here, because the one write path
// that exists (completing a task) already goes to the database and is the only thing
// allowed to create an activity — the +บันทึก FAB was removed in CEO feedback R1.
//
// ⚠️ RLS on `activities` is own-row unless the viewer holds `performance.view_team`, and
// `visible_employee_codes()` resolves to "just me" until the CEO names a team. So this is
// the viewer's own work for almost everyone today. That is the truth, not a missing filter.

interface Ctx {
  activities: Activity[];
  /** Activities logged by one person (by nickname), newest first. */
  activitiesBy: (agent: string) => Activity[];
}

const Ctx = React.createContext<Ctx>({ activities: [], activitiesBy: () => [] });

export const useActivities = () => React.useContext(Ctx);

export function ActivityProvider({
  children,
  activities = [],
}: {
  children: React.ReactNode;
  activities?: Activity[];
}) {
  const value = React.useMemo(
    () => ({
      activities,
      activitiesBy: (agent: string) =>
        activities
          .filter((a) => a.created_by === agent)
          .sort((a, b) => b.date.localeCompare(a.date)),
    }),
    [activities]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
