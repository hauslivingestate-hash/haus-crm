"use client";

import * as React from "react";
import { listActivities, actionAttach, type Activity } from "@/lib/actions";

// Shared LIVE activity log (design-first, in-memory), seeded from the sample rows.
//
// WHY THIS EXISTS (CEO feedback R1, item 4): the +บันทึก FAB was deleted, so completing a
// Daily-Plan task is now the ONLY way an activity gets recorded. That write needs somewhere
// to land that the rest of the app can read, which the old static `listActivities()` array
// could not provide. This provider is that place — the same pattern as NewLeadsProvider.
//
// The activity log is load-bearing: it feeds KPI targets (lib/momentum `targetCurrent`),
// the new-sales rank ladder (lib/probation), entity timelines, and the leaderboard. Anything
// that should reflect newly-logged work must read from HERE, not from `listActivities()`.
//
// ⚠️ KNOWN LIMIT of the design build: server-rendered surfaces (listing detail, lead detail)
// still call `getActivitiesForListing` / `getActivitiesForLead` on the static sample, so a
// just-logged activity will NOT appear in those timelines until reload-independent wiring
// replaces both with a real `activities` table query. Client surfaces (Daily Plan, Targets)
// do see it immediately.
//
// Wire later: `logActivity` becomes an insert into `activities`; this context becomes a
// fetch + mutation layer, and the server-rendered timelines query the table directly.

/** What a caller supplies; id/attach are derived. */
export interface ActivityDraft {
  created_by: string;
  action: string;
  date: string;
  count: number;
  remark: string | null;
  related_lead_id?: string | null;
  related_lead_name?: string | null;
  related_listing_id?: string | null;
  related_listing_name?: string | null;
  /** Stable id — pass the task id so completing/uncompleting a task is idempotent. */
  id?: string;
}

interface Ctx {
  activities: Activity[];
  /** Append one activity. Re-logging the same id replaces the previous row. */
  logActivity: (draft: ActivityDraft) => void;
  /** Remove a logged activity — used when a completed task is un-ticked. */
  removeActivity: (id: string) => void;
  /** Activities logged by one person, newest first. */
  activitiesBy: (agent: string) => Activity[];
}

const Ctx = React.createContext<Ctx | null>(null);

/** Deterministic id for the activity a task produces, so tick/untick is idempotent. */
export function taskActivityId(taskId: string): string {
  return `task_${taskId}`;
}

export function ActivityProvider({ children }: { children: React.ReactNode }) {
  const [activities, setActivities] = React.useState<Activity[]>(() => listActivities());

  const logActivity = React.useCallback((d: ActivityDraft) => {
    const id = d.id ?? `act_${d.action}_${d.date}_${d.created_by}`;
    const row: Activity = {
      id,
      created_by: d.created_by,
      action: d.action,
      attach: actionAttach(d.action),
      related_lead_id: d.related_lead_id ?? null,
      related_lead_name: d.related_lead_name ?? null,
      related_listing_id: d.related_listing_id ?? null,
      related_listing_name: d.related_listing_name ?? null,
      date: d.date,
      count: Math.max(1, Math.min(50, d.count || 1)),
      remark: d.remark?.trim() || null,
    };
    setActivities((xs) => [row, ...xs.filter((x) => x.id !== id)]);
  }, []);

  const removeActivity = React.useCallback((id: string) => {
    setActivities((xs) => xs.filter((x) => x.id !== id));
  }, []);

  const activitiesBy = React.useCallback(
    (agent: string) =>
      activities.filter((a) => a.created_by === agent).sort((a, b) => b.date.localeCompare(a.date)),
    [activities]
  );

  return (
    <Ctx.Provider value={{ activities, logActivity, removeActivity, activitiesBy }}>
      {children}
    </Ctx.Provider>
  );
}

export function useActivities(): Ctx {
  const c = React.useContext(Ctx);
  if (!c) throw new Error("useActivities must be used within ActivityProvider");
  return c;
}
