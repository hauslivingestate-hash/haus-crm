// New-sales probation ladder — CEO-defined ranks whose criteria count the SAME action
// entity the KPI system uses (KpiTemplate.source="activity"), so there is one activity
// vocabulary rather than three.
//
// Phase 6/8: the ladder lives in `probation_rank` + `rank_criterion` (read in
// lib/queries.ts, written in lib/mutations/probation.ts), and membership is
// `main_1_hr.probation_start` / `probation_passed_at`. Everything below is pure — it takes
// the tallies it needs rather than reaching for a seeded log and a stubbed clock.
//
// AUTO-PROMOTE model: rank is DERIVED, not stored. A rank is achieved when ALL its
// criteria are met; the current rank is the longest leading run of achieved ranks
// (the ladder is sequential). Clearing the final rank = passed probation.
//
// ⚠️ Known consequence of deriving live: a `monthly` criterion that was met last month and
// not this one un-achieves its rank. `probation_passed_at` is stored precisely so that
// PASSING, at least, cannot be taken back by a quiet month.

/** Counting window for one criterion — "have both" per Ben:
 *  total = cumulative since probation start · monthly = within the current month. */
export type CriterionWindow = "total" | "monthly";

export const WINDOW_LABEL: Record<CriterionWindow, string> = {
  total: "สะสมรวม",
  monthly: "ต่อเดือน",
};

export interface RankCriterion {
  id: string;
  /** Action name from `action_type` — same vocabulary as ประเภทกิจกรรม / KPI templates. */
  activityType: string;
  target: number;
  window: CriterionWindow;
}

/**
 * Activity tallies for ONE agent, as `${activityType}` → count.
 *
 * Two buckets because criteria count two different ways: `total` since the agent joined
 * the program, `monthly` within the current month. Built server-side in lib/queries.ts so
 * this file needs no database and no clock.
 */
export interface ActivityTally {
  total: Record<string, number>;
  monthly: Record<string, number>;
}

export const EMPTY_TALLY: ActivityTally = { total: {}, monthly: {} };

export interface SalesRank {
  id: string;
  name: string;
  criteria: RankCriterion[];
}

// The ladder the DB is seeded with — kept only as the fallback for a render with no
// session (and as documentation of the shape). The live one comes from `probation_rank`.
// Ordered: index 0 is the first rank to earn; everyone starts below it ("เริ่มต้น").
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
  ladder: SalesRank[],
  tally: ActivityTally = EMPTY_TALLY
): LadderEvaluation {
  const ranks: RankProgress[] = ladder.map((rank) => {
    const criteria = rank.criteria.map((c) => {
      const have = (c.window === "monthly" ? tally.monthly : tally.total)[c.activityType] ?? 0;
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
