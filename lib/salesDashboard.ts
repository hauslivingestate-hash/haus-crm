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
import { caseGaps, toClosedCase, type CaseStatus, type DealGap, type RevenueBasis } from "@/lib/deals";
import { periodKeyOf, periodMultiple, type PeriodLength, type Range } from "@/lib/range";
import { todayISO } from "@/lib/momentum";
import { slaFor, type SlaWindows } from "@/lib/sla";
import type { FollowUpRow, OverdueFollowUps } from "@/lib/followUps";
import { metricOfRow, type WorkMetric } from "@/lib/workTargets";

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
  /** `action_type.side` — which HALF OF THE BUSINESS this is, which is not the same
   *  question as `group_label` (a display name) or `attach` (which record it hangs on).
   *  Sourcing hangs on nothing and is still property work. */
  side: "listing" | "lead" | "general";
  /** `action_type.stage_name` — the buyer step this action advances, or null for work
   *  that advances no particular one. A real FK, so a stage renamed in ตั้งค่า carries
   *  every action with it; matching by label is what Klaichan had to migrate away from. */
  stageName: string | null;
  /** `action_type.owner_stage_name` — the acquisition step this action advances. Same
   *  idea, other pipeline; used only for the row's colour on the owner half today. */
  ownerStageName: string | null;
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
    supabase.from("action_type").select("name,group_label,sort_order,side,stage_name,owner_stage_name,is_active,on_dashboard"),
  ]);

  const meta = new Map(
    (
      (kinds.data ?? []) as {
        name: string;
        group_label: string | null;
        sort_order: number | null;
        side: string | null;
        stage_name: string | null;
        owner_stage_name: string | null;
        is_active: boolean | null;
        on_dashboard: boolean | null;
      }[]
    ).map((k) => [
      k.name,
      {
        group: k.group_label ?? "อื่นๆ",
        sortOrder: Number(k.sort_order ?? 999),
        side: (k.side ?? "general") as ActivityTotal["side"],
        stageName: k.stage_name,
        ownerStageName: k.owner_stage_name,
        active: k.is_active !== false,
        onDashboard: k.on_dashboard !== false,
      },
    ])
  );

  /* THE ROW SET IS THE VOCABULARY, NOT THE LOG.
     Every active action appears, at zero if nobody did it. Three reasons, and the third
     is the one that breaks things:
       · "you logged no Reels this month" is a fact worth seeing; an absent row hides it
       · a row that vanishes when it hits zero makes the card's height jump between ranges
       · a GOAL set on an action with no activity would have no row to draw on, so the
         goal would silently disappear — the exact failure the เป้า switch exists to avoid
     Inactive actions still appear if they have activity in either window: the total on
     this card has to keep matching the activity log. */
  const actions = new Set([
    ...now.keys(),
    ...(before?.keys() ?? []),
    ...[...meta.entries()].filter(([, m]) => m.active).map(([name]) => name),
  ]);

  /* ── ADMIN WORK IS LOGGED BUT NOT SCORED ─────────────────────────────────────
     `on_dashboard = false` (ประชุม, ทำงานหน้าคอม, อื่นๆ). Ben, 2026-09-10: keep the
     action, keep the 286 rows behind it, keep it out of the scoreboard.

     ⚠️ THIS CARD THEREFORE NO LONGER SUMS TO THE ACTIVITY LOG. That is deliberate and it
     is the only place in the app where the two diverge — the activity feed on /today
     still shows every row. Filtered here rather than in the card so there is one answer
     to "what does the dashboard count", and so a second dashboard tab cannot quietly
     disagree with this one. */
  return [...actions]
    .filter((action) => meta.get(action)?.onDashboard !== false)
    .map((action) => {
      const m = meta.get(action);
      return {
        action,
        group: m?.group ?? "อื่นๆ",
        sortOrder: m?.sortOrder ?? 999,
        // An action logged before its type was deleted from ตั้งค่า has no row left to
        // read. It counts as general work rather than vanishing — the total on this card
        // has to keep matching the activity log.
        side: m?.side ?? "general",
        stageName: m?.stageName ?? null,
        ownerStageName: m?.ownerStageName ?? null,
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
  caseId: string;
  /** Null for a case the register could not tie to a lead (ลูกค้านอก). */
  leadId: string | null;
  title: string;
  status: CaseStatus;
  /** What is missing, worst first. Never empty — a complete case is not listed. */
  gaps: DealGap[];
}

/**
 * This person's live cases that are missing their numbers.
 *
 * A case with no figure is revenue the whole app cannot see: absent from the revenue
 * card, from any target, and from the company's own idea of how the month went.
 *
 * Read from closed_case, credited to this person; `caseGaps()` in lib/deals.ts is the one
 * definition of "missing" — a pending case is short its signing facts, a successful one
 * also its transfer facts, and a failed one is never listed because it is over.
 */
export async function getUnpricedCloses(employeeCode: string): Promise<UnpricedClose[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("closed_case")
    .select(
      "case_id,lead_id,listing_id,deal_type,status,closing_date,transfer_date,closing_price,forecast_revenue,real_revenue,remark,buyer_name," +
        "agents:closed_case_agent!inner(employee_code,is_primary,forecast_share,real_share)"
    )
    .eq("agents.employee_code", employeeCode)
    .neq("status", "fail");

  // A failed read is reported as "nothing outstanding" rather than throwing: this is a
  // banner above someone's dashboard, and taking the whole page down over it would be a
  // worse outcome than the banner being briefly absent.
  if (error || !data) return [];

  return (data as unknown as Record<string, unknown>[])
    .map(toClosedCase)
    .map((c) => ({
      caseId: c.case_id,
      leadId: c.lead_id,
      title: c.buyer_name ?? c.listing_id ?? c.case_id,
      status: c.status,
      gaps: caseGaps(c),
    }))
    .filter((r) => r.gaps.length > 0)
    // Most incomplete first — a case missing everything is the one worth opening.
    .sort((a, b) => b.gaps.length - a.gaps.length || a.caseId.localeCompare(b.caseId));
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

/**
 * Everything this person is late contacting, both sides of the business.
 *
 * ── IT IS A WORKLIST, NOT A COUNT ───────────────────────────────────────────────
 * HAUS runs six agents against a rule nobody currently meets, so a bare "27" is a number
 * people learn to ignore by the second day. A short ordered list of WHICH ONES is a
 * morning's work. Never-contacted first, then furthest past the window.
 *
 * ── BOTH SIDES, ONE LIST ────────────────────────────────────────────────────────
 * Leads and listings are merged and ranked together rather than shown as two lists. They
 * compete for the same hour: an owner unheard from for two months outranks a lead one day
 * over, and two separate lists would have hidden that. Each row says which side it is,
 * because a name alone does not — an owner filed under a nickname and a lead named after
 * the project they want look identical.
 *
 * ── `is_open`, NOT A HARDCODED STATUS NAME ──────────────────────────────────────
 * Both status lists are editable in ตั้งค่า. Reading the flag means a rename cannot
 * silently empty this card, which `lead_status = 'Active'` could.
 *
 * ── A GRADE WITH NO WINDOW IS SILENT ────────────────────────────────────────────
 * lib/sla.ts, and Ben's decision of 2026-09-06. Klaichan defaults to 30 days, which means
 * no grade can ever be switched off. Here the absence of a number is the decision.
 */
export async function getOverdueFollowUps(
  employeeCode: string,
  limit = 8
): Promise<OverdueFollowUps> {
  const supabase = await createClient();

  const [leadGrades, listingGrades, leadStatuses, listingStatuses, leadRes, listingRes] =
    await Promise.all([
      supabase.from("potential").select("name,sla_days"),
      supabase.from("listing_potential").select("name,sla_days"),
      supabase.from("lead_status").select("name,is_open"),
      supabase.from("listing_status").select("name,is_open"),
      supabase
        .from("main_6_buyer_crm")
        .select(
          "lead_id,lead_name,potential,pipeline_stage,lead_status,last_follow_date,listing_code"
        )
        .eq("sale_id", employeeCode)
        .not("potential", "is", null),
      // v_main_listing, not the base table: `effective_sale_id` falls back to the zone's
      // primary agent, and it is what "my listings" means everywhere else in the app.
      supabase
        .from("v_main_listing")
        .select(
          "listing_id,listing_name,potential,listing_status,owner_name,owner_talk_last_date"
        )
        .eq("effective_sale_id", employeeCode)
        .not("potential", "is", null),
    ]);

  const windowsOf = (res: { data: unknown }): SlaWindows => {
    const out: SlaWindows = {};
    for (const g of (res.data ?? []) as { name: string; sla_days: number | null }[]) {
      out[g.name] = g.sla_days;
    }
    return out;
  };
  const openOf = (res: { data: unknown }): Set<string> =>
    new Set(
      ((res.data ?? []) as { name: string; is_open: boolean }[])
        .filter((r) => r.is_open)
        .map((r) => r.name)
    );

  const leadWindows = windowsOf(leadGrades);
  const listingWindows = windowsOf(listingGrades);
  const openLeads = openOf(leadStatuses);
  const openListings = openOf(listingStatuses);

  const rows: FollowUpRow[] = [];

  for (const l of (leadRes.data ?? []) as {
    lead_id: string;
    lead_name: string | null;
    potential: string | null;
    pipeline_stage: string | null;
    lead_status: string | null;
    last_follow_date: string | null;
    listing_code: string | null;
  }[]) {
    if (!l.lead_status || !openLeads.has(l.lead_status)) continue;
    const state = slaFor(leadWindows, l.potential, l.last_follow_date);
    if (!state.overdue || state.window == null) continue;
    rows.push({
      side: "lead",
      id: l.lead_id,
      name: l.lead_name || l.lead_id,
      subtitle: l.listing_code,
      grade: l.potential,
      days: state.days,
      window: state.window,
      over: state.over,
      onPlan: false,
    });
  }

  for (const l of (listingRes.data ?? []) as {
    listing_id: string;
    listing_name: string | null;
    potential: string | null;
    listing_status: string | null;
    owner_name: string | null;
    owner_talk_last_date: string | null;
  }[]) {
    if (!l.listing_status || !openListings.has(l.listing_status)) continue;
    const state = slaFor(listingWindows, l.potential, l.owner_talk_last_date);
    if (!state.overdue || state.window == null) continue;
    rows.push({
      side: "listing",
      id: l.listing_id,
      // The OWNER is who gets called. The unit is what the call is about and goes
      // underneath — a row headed with a building name is a row you cannot ring.
      name: l.owner_name || l.listing_name || l.listing_id,
      subtitle: l.listing_name,
      grade: l.potential,
      days: state.days,
      window: state.window,
      over: state.over,
      onPlan: false,
    });
  }

  const totalLeads = rows.filter((r) => r.side === "lead").length;
  const totalListings = rows.length - totalLeads;

  // Never contacted first — a graded record nobody has ever rung is the most overdue
  // thing here, and `over` cannot rank it because there is no window to be past.
  rows.sort((a, b) => {
    if ((a.days === null) !== (b.days === null)) return a.days === null ? -1 : 1;
    return b.over - a.over || a.id.localeCompare(b.id);
  });

  const shown = rows.slice(0, limit);

  /* ── ALREADY ON TODAY'S PLAN ────────────────────────────────────────────────
     Asked only for the rows being shown. This is what keeps the + button honest across a
     reload: without it, promoting a row and refreshing would offer to promote it again,
     and the second tap would write a duplicate task. */
  if (shown.length > 0) {
    const leadIds = shown.filter((r) => r.side === "lead").map((r) => r.id);
    const listingIds = shown.filter((r) => r.side === "listing").map((r) => r.id);
    // Values are double-quoted: PostgREST splits `in.(...)` on commas, so an id that ever
    // contained one would silently become two ids and match nothing.
    const list = (ids: string[]) => ids.map((v) => `"${v}"`).join(",");
    const filter = [
      leadIds.length ? `related_lead_id.in.(${list(leadIds)})` : null,
      listingIds.length ? `related_listing_id.in.(${list(listingIds)})` : null,
    ]
      .filter(Boolean)
      .join(",");
    const { data: tasks } = await supabase
      .from("tasks")
      .select("related_lead_id,related_listing_id")
      .eq("employee_code", employeeCode)
      .eq("task_date", todayISO())
      // `done` is nullable, and `eq false` does not match NULL — a task written before the
      // column had a default would read as unclaimed for ever.
      .not("done", "is", true)
      .or(filter);
    const claimed = new Set(
      ((tasks ?? []) as { related_lead_id: string | null; related_listing_id: string | null }[])
        .flatMap((t) => [
          t.related_lead_id ? `lead:${t.related_lead_id}` : null,
          t.related_listing_id ? `listing:${t.related_listing_id}` : null,
        ])
        .filter(Boolean) as string[]
    );
    for (const r of shown) r.onPlan = claimed.has(`${r.side}:${r.id}`);
  }

  return { rows: shown, totalLeads, totalListings };
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

/* ---------- the owner side ------------------------------------------------------- */

export interface OwnerFunnelStep {
  stage: string;
  reached: number;
  cohort: number;
}

/**
 * กรวยเจ้าของ — of the units taken on in this window, how far the owner conversation got.
 *
 * ⚠️ NOT THE SAME KIND OF NUMBER AS THE BUYER FUNNEL, and the card says so.
 * `lead_stage_event` records every buyer move, so that funnel can honestly claim
 * "furthest reached". There is no owner_stage log, so this reads where each unit sits
 * NOW and assumes the owner conversation only moves forward. A listing that reached
 * Exclusive Offer and was walked back to Owner Talk is counted at Owner Talk.
 *
 * An owner_stage event log is the honest fix and is its own piece of work. Reporting the
 * standing position, labelled as the standing position, is the truthful thing to do
 * meanwhile — leaving the acquisition half with no funnel at all was the worse option.
 */
export async function getOwnerFunnel(
  employeeCode: string,
  range: Range
): Promise<OwnerFunnelStep[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dash_owner_funnel", {
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

/* ---------- goals on the work rows ----------------------------------------------- */

export interface WorkTargets {
  /** metric → the figure THIS range is measured against. Scaled only for a custom
      window, which is measured in days against the daily figure. */
  resolved: Record<WorkMetric, number>;
  /** metric → the unscaled standing figure for this period length — what the inline
      editor loads and writes back. Saving a scaled number as a standing one would
      quietly inflate the goal every time somebody opened the form on a custom range. */
  standing: Record<WorkMetric, number>;
  /** True when a row keyed to this exact period beat the standing one, for at least one
      metric — the editor says so rather than silently showing a figure it will not
      overwrite. */
  hasOverride: boolean;
}

/**
 * Every work goal that applies to this range, and the standing figures behind them.
 *
 * Same three rules as เป้ารายได้, for the same reasons (see resolveRevenueTarget):
 *   NO PRO-RATING      a real number per period length; nothing is divided
 *   OVERRIDE > STANDING a row for '2026-09' beats the '' row
 *   `official` ONLY     a stretch goal must never become the bar somebody is scored on
 *
 * One round trip for the whole card. A query per row would be twenty.
 */
export async function getWorkTargets(
  employeeCode: string,
  range: Range
): Promise<WorkTargets> {
  const supabase = await createClient();
  const key = periodKeyOf(range);

  const { data, error } = await supabase
    .from("targets")
    .select("source,activity_type,stage_name,owner_stage_name,period_key,target")
    .eq("employee_code", employeeCode)
    .eq("owner", "official")
    .is("month", null)
    .in("source", ["activity", "stage", "owner_stage"])
    .eq("period", range.period)
    .in("period_key", ["", key]);
  if (error || !data) return { resolved: {}, standing: {}, hasOverride: false };

  const rows = data as {
    source: string;
    activity_type: string | null;
    stage_name: string | null;
    owner_stage_name: string | null;
    period_key: string;
    target: number;
  }[];

  const standing: Record<WorkMetric, number> = {};
  const override: Record<WorkMetric, number> = {};
  for (const r of rows) {
    const metric = metricOfRow(r);
    if (!metric) continue;
    (r.period_key === "" ? standing : override)[metric] = Number(r.target ?? 0);
  }

  const multiple = periodMultiple(range);
  const resolved: Record<WorkMetric, number> = {};
  for (const [metric, amount] of Object.entries({ ...standing, ...override })) {
    if (amount > 0) resolved[metric] = amount * multiple;
  }

  return { resolved, standing, hasOverride: Object.keys(override).length > 0 };
}

/** Every standing work goal for one person at one period length, keyed by metric —
    what the inline editor loads when it is opened on a range whose period differs from
    the one the card just resolved. Kept separate from getWorkTargets so the editor can
    never write a resolved (scaled) figure back as a standing one. */
export async function getStandingWorkTargets(
  employeeCode: string,
  period: PeriodLength
): Promise<Record<WorkMetric, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("targets")
    .select("source,activity_type,stage_name,owner_stage_name,target")
    .eq("employee_code", employeeCode)
    .eq("owner", "official")
    .is("month", null)
    .in("source", ["activity", "stage", "owner_stage"])
    .eq("period", period)
    .eq("period_key", "");
  if (error || !data) return {};

  const out: Record<WorkMetric, number> = {};
  for (const r of data as {
    source: string;
    activity_type: string | null;
    stage_name: string | null;
    owner_stage_name: string | null;
    target: number;
  }[]) {
    const metric = metricOfRow(r);
    if (metric) out[metric] = Number(r.target ?? 0);
  }
  return out;
}
