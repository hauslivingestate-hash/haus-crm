// New-sales probation ladder — CEO-defined ranks whose criteria count the SAME action
// entity the KPI system uses (KpiTemplate.source="activity"). Design-first: the seed ladder
// below is edited in Settings (ProbationProvider, in-memory); tallies read the unified
// activity log (lib/actions). Wire later = probation_rank + rank_criterion tables and a
// promotion log (rank_achieved_at events) so monthly dips can't demote an earned rank —
// the live-derived preview here recomputes every render instead.
//
// AUTO-PROMOTE model: rank is DERIVED, not stored. A rank is achieved when ALL its
// criteria are met; the current rank is the longest leading run of achieved ranks
// (the ladder is sequential). Clearing the final rank = passed probation.

import { listActivities, type Activity } from "@/lib/actions";
import { TODAY } from "@/lib/momentum";

/** Counting window for one criterion — "have both" per Ben:
 *  total = cumulative since probation start · monthly = within the current month. */
export type CriterionWindow = "total" | "monthly";

export const WINDOW_LABEL: Record<CriterionWindow, string> = {
  total: "สะสมรวม",
  monthly: "ต่อเดือน",
};

export interface RankCriterion {
  id: string;
  /** Action name from ACTION_GROUPS — same vocabulary as ประเภทกิจกรรม / KPI templates. */
  activityType: string;
  target: number;
  window: CriterionWindow;
}

export interface SalesRank {
  id: string;
  name: string;
  criteria: RankCriterion[];
}

// Seed ladder (CEO edits in Settings → Rank เซลล์ใหม่). Ordered: index 0 is the first
// rank to earn; everyone starts below it ("เริ่มต้น"). Passing the last = ผ่านโปรเบชั่น.
export const SEED_SALES_RANKS: SalesRank[] = [
  {
    id: "r_rookie",
    name: "Rookie",
    criteria: [
      { id: "c_r1_call", activityType: "Call", target: 20, window: "total" },
      { id: "c_r1_survey", activityType: "Survey", target: 5, window: "total" },
    ],
  },
  {
    id: "r_junior",
    name: "Junior",
    criteria: [
      { id: "c_r2_call", activityType: "Call", target: 30, window: "monthly" },
      { id: "c_r2_show", activityType: "Show", target: 5, window: "total" },
      { id: "c_r2_owner", activityType: "Owner Visit", target: 4, window: "total" },
    ],
  },
  {
    id: "r_pro",
    name: "Senior",
    criteria: [
      { id: "c_r3_show", activityType: "Show", target: 10, window: "total" },
      { id: "c_r3_win", activityType: "Win", target: 1, window: "total" },
    ],
  },
];

/** Tally one action for one agent from the unified log. `monthly` counts the current
 *  (stubbed) month; `total` counts everything since `since` (probation start, if given). */
export function tallyAction(
  nickname: string,
  activityType: string,
  window: CriterionWindow,
  since?: string,
  /** LIVE log (ActivityProvider). Defaults to the static sample for non-React callers —
   *  pass the live array so ticking a Daily-Plan task re-ranks immediately. */
  activities: Activity[] = listActivities()
): number {
  const month = TODAY.slice(0, 7);
  return activities
    .filter((a) => a.created_by === nickname && a.action === activityType)
    .filter((a) => (window === "monthly" ? a.date.startsWith(month) : !since || a.date >= since))
    .reduce((sum, a) => sum + a.count, 0);
}

export interface CriterionProgress extends RankCriterion {
  have: number;
  met: boolean;
}

export interface RankProgress {
  rank: SalesRank;
  criteria: CriterionProgress[];
  /** All criteria met → rank achieved. */
  achieved: boolean;
  /** 0..1 — average completion across criteria (each capped at 100%). */
  pct: number;
}

export interface LadderEvaluation {
  ranks: RankProgress[];
  /** Index of the highest rank in the leading achieved run; -1 = none yet (เริ่มต้น). */
  currentIndex: number;
  /** The rank currently being worked toward (null once passed). */
  next: RankProgress | null;
  /** Cleared the whole ladder → passed probation. */
  passed: boolean;
}

/** Derive an agent's ladder position from the activity log (auto-promote = pure derivation). */
export function evaluateLadder(
  nickname: string,
  ladder: SalesRank[],
  probationStart?: string,
  activities?: Activity[]
): LadderEvaluation {
  const ranks: RankProgress[] = ladder.map((rank) => {
    const criteria = rank.criteria.map((c) => {
      const have = tallyAction(nickname, c.activityType, c.window, probationStart, activities);
      return { ...c, have, met: have >= c.target };
    });
    const pct = criteria.length
      ? criteria.reduce((s, c) => s + Math.min(1, c.have / c.target), 0) / criteria.length
      : 0;
    return { rank, criteria, achieved: criteria.every((c) => c.met), pct };
  });

  // Sequential ladder: current rank = longest leading run of achieved ranks.
  let currentIndex = -1;
  for (const r of ranks) {
    if (!r.achieved) break;
    currentIndex++;
  }
  const passed = currentIndex === ranks.length - 1 && ranks.length > 0;
  return { ranks, currentIndex, next: passed ? null : (ranks[currentIndex + 1] ?? null), passed };
}

/** Display name of the currently-held rank. */
export function currentRankName(ev: LadderEvaluation): string {
  if (ev.passed) return "ผ่านโปรเบชั่น";
  return ev.currentIndex >= 0 ? ev.ranks[ev.currentIndex].rank.name : "เริ่มต้น";
}

/** Sort key for the leaderboard: rank first, then progress toward the next rank. */
export function ladderScore(ev: LadderEvaluation): number {
  return (ev.currentIndex + 1) * 100 + (ev.next ? ev.next.pct * 99 : 99);
}
