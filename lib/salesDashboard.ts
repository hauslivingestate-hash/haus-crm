/* Server reads for the ขาย tab of the dashboard.
 *
 * ── SCOPE: ONE PERSON, ALWAYS THE VIEWER ────────────────────────────────────────
 * The sales dashboard is a scoreboard for the person reading it. It never shows the
 * team, even for a CEO — the team view is its own tab (lib/dashboardTabs.ts), because
 * "how am I doing" and "how are they doing" are different questions and a card that
 * silently answers the second when a leader opens it is a card nobody can trust.
 *
 * ⚠️ Every query filters `employee_code` / `sale_id` EXPLICITLY rather than leaning on
 * RLS — the same rule lib/plan.ts follows, and for the same reason. RLS is a ceiling,
 * not a filter: the policies on `activities` and `main_6_buyer_crm` also admit
 * `performance.view_team` and `leads.view_all`, so without the explicit filter a CEO's
 * personal dashboard would quietly show the whole company's numbers as their own.
 */

import { createClient } from "@/lib/supabase/server";
import { CLOSED_DEAL_STAGES, dealGaps, type DealGap, type RevenueBasis } from "@/lib/deals";
import { periodKeyOf, periodMultiple, type PeriodLength, type Range } from "@/lib/range";
import { todayISO } from "@/lib/momentum";
import { slaFor, type SlaWindows } from "@/lib/sla";

/* ---------- activity ------------------------------------------------------------- */

export interface ActivityTotal {
  /** `action_type.name` — the company's own vocabulary, not a set invented here. */
  action: string;
  /** `action_type.group_label` — "งานทรัพย์" / "ไปป์ไลน์ (ลูกค้า)" / "ทั่วไป".
   *  THE SPLIT COMES FROM THE DATA, not a list in the card. Klaichan reads
   *  `activity_kind.scope` for the same reason: the halves can then never drift from
   *  what someone sets in ตั้งค่า. An action with no row falls into "อื่นๆ" rather than
   *  disappearing. */
  group: string;
  /** The stored order, so the card reads in business order rather than however the rows
   *  happened to arrive. */
  sortOrder: number;
  /** Work logged inside the range. */
  total: number;
  /** The same figure for the equivalent prior window; null for a custom range, which
      has no canonical previous period. */
  prev: number | null;
}

/**
 * How much work this person logged in the window, by action.
 *
 * Grouped in Postgres (`dash_activity_counts`), not in JS — "ปีนี้" is ~1,600 rows for
 * an active agent and the answer is twenty numbers.
 *
 * The result is the UNION of both windows' actions, so an action that ran at 12 last
 * month and 0 this month still appears, at zero. Dropping it would hide exactly the
 * change worth seeing.
 */
export async function getActivityTotals(employeeCode: string, range: Range): Promise<ActivityTotal[]> {
  const supabase = await createClient();

  const read = async (from: string, to: string) => {
    const { data, error } = await supabase.rpc("dash_activity_counts", {
      p_employee_code: employeeCode,
      p_from: from,
      p_to: to,
    });
    if (error) return new Map<string, number>();
    return new Map((data as { action: string; total: number }[]).map((r) => [r.action, Number(r.total)]));
  };

  const [now, before, kinds] = await Promise.all([
    read(range.start, range.end),
    range.prev ? read(range.prev.start, range.prev.end) : Promise.resolve(null),
    supabase.from("action_type").select("name,group_label,sort_order"),
  ]);

  const meta = new Map(
    ((kinds.data ?? []) as { name: string; group_label: string | null; sort_order: number | null }[]).map(
      (k) => [k.name, { group: k.group_label ?? "อื่นๆ", sortOrder: Number(k.sort_order ?? 999) }]
    )
  );

  const actions = new Set([...now.keys(), ...(before?.keys() ?? [])]);
  return [...actions]
    .map((action) => {
      const m = meta.get(action);
      return {
        action,
        group: m?.group ?? "อื่นๆ",
        sortOrder: m?.sortOrder ?? 999,
        total: now.get(action) ?? 0,
        prev: before ? before.get(action) ?? 0 : null,
      };
    })
    // Business order, then name — stable between renders rather than shuffling every
    // time two actions draw level.
    .sort((a, b) => a.sortOrder - b.sortOrder || a.action.localeCompare(b.action));
}

/* ---------- closed deals with no numbers ----------------------------------------- */

export interface UnpricedClose {
  leadId: string;
  leadName: string | null;
  stage: string | null;
  /** What is missing, worst first. Never empty — a complete deal is not listed. */
  gaps: DealGap[];
}

/**
 * This person's closed deals that are missing their money.
 *
 * A closed case with no commission is revenue the whole app cannot see: it is absent
 * from the revenue card, from any target, and from the company's own idea of how the
 * month went. Today that is every closed deal in the database — 29 leads sit at
 * Win/Close and not one carries a closing price.
 *
 * ── ONE DEFINITION OF "CLOSED", AND IT IS NOT THIS FILE'S ───────────────────────
 * lib/deals.ts owns it (`isClosed` — five independent facts, because the stage
 * dropdown is the least reliable signal on the row). The `.or()` below is only a
 * PREFILTER that keeps the read small, and it is deliberately built from the same
 * exported set so it can never become narrower than the check that follows it. The
 * authoritative filter is `dealGaps()` in JS.
 */
export async function getUnpricedCloses(employeeCode: string): Promise<UnpricedClose[]> {
  const supabase = await createClient();

  const stages = [...CLOSED_DEAL_STAGES].join(",");
  const { data, error } = await supabase
    .from("main_6_buyer_crm")
    .select("lead_id,lead_name,pipeline_stage,closing_price,closing_date,transfer_date,commission")
    .eq("sale_id", employeeCode)
    .or(
      `pipeline_stage.in.(${stages}),commission.not.is.null,closing_price.not.is.null,` +
        `closing_date.not.is.null,transfer_date.not.is.null`
    );

  // A failed read is reported as "nothing outstanding" rather than throwing: this is a
  // banner above someone's dashboard, and taking the whole page down over it would be a
  // worse outcome than the banner being briefly absent.
  if (error || !data) return [];

  return data
    .map((r) => ({
      leadId: r.lead_id as string,
      leadName: (r.lead_name as string | null) ?? null,
      stage: (r.pipeline_stage as string | null) ?? null,
      gaps: dealGaps(r),
    }))
    .filter((r) => r.gaps.length > 0)
    // Most incomplete first — a deal missing all three is the one worth opening.
    .sort((a, b) => b.gaps.length - a.gaps.length || a.leadId.localeCompare(b.leadId));
}

/* ---------- revenue -------------------------------------------------------------- */

export interface RevenueSummary {
  /** Commission signed inside the range. */
  actual: number;
  /** The same figure for the equivalent prior window; null for a custom range. */
  previous: number | null;
  /** Deals signed inside the range — the "N ดีล" under the bar. */
  cases: number;
  /** What this range is measured against, in baht. 0 = the CEO has not set one. */
  target: number;
  /** Which period length that target was set for — the card says so, so nobody reads a
      yearly figure as a monthly one. */
  targetPeriod: PeriodLength;
  /** True when a row for this exact period beat the standing one. */
  targetIsOverride: boolean;
  /** Which basis produced `actual` — the card must say so, since the same deal counts in
      a different month on the other one. */
  basis: RevenueBasis;
  /** How much of the range has elapsed, 0–1 — the pace marker on the bar. */
  elapsed: number;
}

/**
 * The revenue target for a range, in baht, and where it came from.
 *
 * ── NO PRO-RATING. THIS IS THE WHOLE POINT ──────────────────────────────────────
 * The first version of this file stored one monthly figure and divided it by days to
 * fill a "7 วัน" or "ไตรมาสนี้" bar. Klaichan CRM considered exactly that and rejected
 * it: pro-rating a monthly figure across a quarter is arithmetic pretending to be a
 * goal, because Thai property is not flat across the year and a Songkran month is not a
 * March. The leader now sets a real number per period length, and the range simply picks
 * the one that matches. Nothing is divided.
 *
 * ── OVERRIDE BEATS STANDING ─────────────────────────────────────────────────────
 * A row keyed to this exact period ('2026-09', '2026-Q3') wins over the standing row
 * (''), so one unusual month can carry its own figure without disturbing the rest.
 *
 * ── ONLY `official` COUNTS ──────────────────────────────────────────────────────
 * Ben, 2026-09-10: the CEO sets the sale's target, not the sale. A `stretch` row is the
 * sale's own private extra and must never become the bar they are measured against, or
 * anyone could quietly lower their own goal.
 */
async function resolveRevenueTarget(
  employeeCode: string,
  range: Range
): Promise<{ amount: number; isOverride: boolean }> {
  const supabase = await createClient();
  const key = periodKeyOf(range);

  const { data, error } = await supabase
    .from("targets")
    .select("period_key,target")
    .eq("employee_code", employeeCode)
    .eq("owner", "official")
    .eq("source", "revenue")
    .eq("period", range.period)
    .in("period_key", ["", key]);
  if (error || !data) return { amount: 0, isOverride: false };

  const override = data.find((r) => r.period_key === key);
  const standing = data.find((r) => r.period_key === "");
  const base = Number((override ?? standing)?.target ?? 0);
  // Only ever >1 for a custom window, which is measured in days against the daily figure.
  return { amount: base * periodMultiple(range), isOverride: !!override };
}

/** Every standing revenue target for one person, keyed by period length — what the
    inline ตั้งเป้า editor loads. Unscaled: the editor writes the standing figure itself
    and must never save a scaled number back as a standing one. */
export async function getStandingRevenueTargets(
  employeeCode: string
): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("targets")
    .select("period,target")
    .eq("employee_code", employeeCode)
    .eq("owner", "official")
    .eq("source", "revenue")
    .eq("period_key", "");
  if (error || !data) return {};
  return Object.fromEntries(data.map((r) => [r.period as string, Number(r.target ?? 0)]));
}

/** Commission signed by this person in the window, against what they were asked for. */
export async function getRevenueSummary(
  employeeCode: string,
  range: Range,
  basis: RevenueBasis
): Promise<RevenueSummary> {
  const supabase = await createClient();

  const read = async (from: string, to: string) => {
    const { data, error } = await supabase.rpc("dash_revenue_monthly", {
      p_sale_id: employeeCode,
      p_from: from,
      p_to: to,
      p_basis: basis,
    });
    if (error || !data) return { total: 0, cases: 0 };
    return (data as { total: number; cases: number }[]).reduce(
      (acc, r) => ({ total: acc.total + Number(r.total ?? 0), cases: acc.cases + Number(r.cases ?? 0) }),
      { total: 0, cases: 0 }
    );
  };

  const [now, before, target] = await Promise.all([
    read(range.start, range.end),
    range.prev ? read(range.prev.start, range.prev.end) : Promise.resolve(null),
    resolveRevenueTarget(employeeCode, range),
  ]);

  return {
    actual: now.total,
    previous: before ? before.total : null,
    cases: now.cases,
    target: target.amount,
    targetPeriod: range.period,
    targetIsOverride: target.isOverride,
    basis,
    elapsed: range.elapsed,
  };
}

export interface TrendPoint {
  /** YYYY-MM. */
  month: string;
  revenue: number;
  cases: number;
}

/**
 * Monthly signed commission, oldest first.
 *
 * A CONTINUOUS series — months with no deal are filled with zero. Without that, a quiet
 * June is simply absent and the chart draws a straight line from May to July, showing a
 * smooth climb where the truth is a gap. That is the most common way a revenue chart
 * lies, and with a dozen deals in the whole database it would happen immediately.
 *
 * Deliberately OUTSIDE the range filter: a trend needs a span longer than the thing
 * being filtered, and "วันนี้" would collapse it to a single point.
 */
export async function getRevenueTrend(
  employeeCode: string,
  basis: RevenueBasis,
  months = 12
): Promise<TrendPoint[]> {
  const supabase = await createClient();
  const today = todayISO();

  const endIdx = Number(today.slice(0, 4)) * 12 + (Number(today.slice(5, 7)) - 1);
  const startIdx = endIdx - (months - 1);
  const keyOf = (idx: number) => `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;

  const { data, error } = await supabase.rpc("dash_revenue_monthly", {
    p_sale_id: employeeCode,
    p_from: `${keyOf(startIdx)}-01`,
    p_to: today,
    p_basis: basis,
  });

  const byMonth = new Map(
    error || !data
      ? []
      : (data as { month: string; total: number; cases: number }[]).map((r) => [
          r.month,
          { revenue: Number(r.total ?? 0), cases: Number(r.cases ?? 0) },
        ])
  );

  return Array.from({ length: months }, (_, i) => {
    const month = keyOf(startIdx + i);
    const hit = byMonth.get(month);
    return { month, revenue: hit?.revenue ?? 0, cases: hit?.cases ?? 0 };
  });
}

/* ---------- pipeline ------------------------------------------------------------- */

export interface StageMovement {
  stage: string;
  /** Leads that MOVED INTO this stage inside the window. */
  moves: number;
  /** Leads sitting on this stage right now — context for the movement. */
  standing: number;
}

/**
 * How the pipeline moved in the window, and where it stands now.
 *
 * `moves`, not "leads currently here". A count of where leads sit today has no time
 * dimension: it reads identically for วันนี้ and ปีนี้, which is the one thing a filtered
 * dashboard must not do. `lead_stage_event` exists precisely so "how many reached Show in
 * September" is answerable.
 *
 * ⚠️ THE LOG STARTS 2026-09-10. Every lead that already existed carries one `baseline`
 * row, excluded from `moves`, so this reads 0 moves everywhere until people start moving
 * leads. That is correct and it is not a bug: the history was never recorded and inventing
 * it would be worse. `standing` is real from day one.
 */
export async function getStageMovement(employeeCode: string, range: Range): Promise<StageMovement[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dash_stage_moves", {
    p_sale_id: employeeCode,
    p_from: range.start,
    p_to: range.end,
  });
  if (error || !data) return [];
  return (data as { stage: string; moves: number; standing: number }[]).map((r) => ({
    stage: r.stage,
    moves: Number(r.moves ?? 0),
    standing: Number(r.standing ?? 0),
  }));
}

/* ---------- follow-up SLA -------------------------------------------------------- */

export interface OverdueLead {
  leadId: string;
  leadName: string | null;
  grade: string | null;
  stage: string | null;
  /** Days since last contact. null = never contacted. */
  days: number | null;
  /** The grade's window, in days. */
  window: number;
  /** Days past the window; 0 when never contacted (there is no "past" to measure). */
  over: number;
}

export interface OverdueFollowUps {
  /** Every overdue lead, not just the ones listed. */
  count: number;
  /** The worst offenders, worst first — a worklist, not a scoreboard. */
  rows: OverdueLead[];
}

/**
 * ติดตามเกินกำหนด — this person's leads that are past their follow-up window.
 *
 * ── THE RULE IS NOT RESTATED HERE ───────────────────────────────────────────────
 * lib/sla.ts owns it, and the window per grade lives on `potential.sla_days`, edited in
 * ตั้งค่า → สีสถานะ & SLA. This function passes both to `slaFor()` rather than writing
 * `last_follow_date < today - N` in SQL: a second copy of the rule is a second rule, and
 * this one is already painting cells on /leads and /listings. The two must agree, so
 * only one of them may exist.
 *
 * That is why the rows come back to JS instead of being filtered in Postgres. The
 * prefilter keeps it honest — only Active leads on a grade that actually HAS a window,
 * which is a few dozen rows per person, not the 1,058-row table.
 *
 * ── A BLANK WINDOW MEANS NO SLA ─────────────────────────────────────────────────
 * Grades C, New Lead and Agent carry no window today and are therefore never overdue.
 * That is a decision, not missing configuration — see the header of lib/sla.ts.
 *
 * ── NEVER CONTACTED IS THE WORST CASE ───────────────────────────────────────────
 * It sorts to the top. A graded lead nobody has ever called is the most overdue thing
 * on the list, and treating a missing date as "fine" is how those rows stay invisible.
 */
export async function getOverdueFollowUps(employeeCode: string, limit = 8): Promise<OverdueFollowUps> {
  const supabase = await createClient();

  const [gradeRes, leadRes] = await Promise.all([
    supabase.from("potential").select("name,sla_days"),
    supabase
      .from("main_6_buyer_crm")
      .select("lead_id,lead_name,potential,pipeline_stage,last_follow_date")
      .eq("sale_id", employeeCode)
      .eq("lead_status", "Active")
      .not("potential", "is", null),
  ]);

  if (gradeRes.error || leadRes.error || !gradeRes.data || !leadRes.data) {
    return { count: 0, rows: [] };
  }

  const windows: SlaWindows = {};
  for (const g of gradeRes.data as { name: string; sla_days: number | null }[]) {
    windows[g.name] = g.sla_days;
  }

  const overdue: OverdueLead[] = [];
  for (const l of leadRes.data as {
    lead_id: string;
    lead_name: string | null;
    potential: string | null;
    pipeline_stage: string | null;
    last_follow_date: string | null;
  }[]) {
    const state = slaFor(windows, l.potential, l.last_follow_date);
    if (!state.overdue || state.window == null) continue;
    overdue.push({
      leadId: l.lead_id,
      leadName: l.lead_name,
      grade: l.potential,
      stage: l.pipeline_stage,
      days: state.days,
      window: state.window,
      over: state.over,
    });
  }

  // Never-contacted first (days === null), then furthest past the window.
  overdue.sort((a, b) => {
    if ((a.days === null) !== (b.days === null)) return a.days === null ? -1 : 1;
    return b.over - a.over || a.leadId.localeCompare(b.leadId);
  });

  return { count: overdue.length, rows: overdue.slice(0, limit) };
}

/* ---------- แผนวันนี้ ------------------------------------------------------------- */

export interface TodaySummary {
  done: number;
  total: number;
}

/**
 * Today's task count — a pointer to แผนวันนี้, not a second copy of it.
 *
 * ── WHY THIS IS A NUMBER AND NOT THE PLANNER ────────────────────────────────────
 * Klaichan puts its whole planner inside the dashboard, because Klaichan has no separate
 * plan page. HAUS has /today: a full client island holding optimistic state, task
 * composition, repeats and the leave form. Rendering a second copy here would mean two
 * surfaces that can disagree about whether a task is ticked, and every future change to
 * the planner would have to be made twice.
 *
 * So the dashboard carries the one fact worth seeing from across the room — how much of
 * today is done — and a way in.
 */
export async function getTodaySummary(employeeCode: string): Promise<TodaySummary> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("done")
    .eq("employee_code", employeeCode)
    .eq("task_date", todayISO());

  if (error || !data) return { done: 0, total: 0 };
  return {
    done: data.filter((t) => t.done).length,
    total: data.length,
  };
}

/* ---------- กรวยการขาย ------------------------------------------------------------ */

export interface FunnelStep {
  stage: string;
  /** Leads from the window's intake that got at least this far. */
  reached: number;
  /** The whole cohort — the denominator every step shares. */
  cohort: number;
}

/**
 * Of the leads RECEIVED in this window, how far each one got.
 *
 * A cohort, not a snapshot: every step counts everyone at or beyond it, so the bars can
 * only narrow and the percentages are real conversion rates. "Leads sitting on each
 * stage" can never produce those — a lead at Show is simply absent from Lead, so the
 * numbers do not nest and a ratio between two of them means nothing.
 *
 * Uses the FURTHEST stage a lead reached rather than where it sits now: one that got to
 * Nego and was moved back to Follow still passed through Nego.
 */
export async function getLeadFunnel(employeeCode: string, range: Range): Promise<FunnelStep[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dash_lead_funnel", {
    p_sale_id: employeeCode,
    p_from: range.start,
    p_to: range.end,
  });
  if (error || !data) return [];
  return (data as { stage: string; reached: number; cohort: number }[]).map((r) => ({
    stage: r.stage,
    reached: Number(r.reached ?? 0),
    cohort: Number(r.cohort ?? 0),
  }));
}
