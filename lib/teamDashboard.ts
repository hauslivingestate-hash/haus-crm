import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { periodKeyOf, periodMultiple, type Range } from "@/lib/range";
import { todayISO } from "@/lib/momentum";
import type { RevenueBasis } from "@/lib/deals";
import type { RevenueSummary, TrendPoint } from "@/lib/salesDashboard";
import { avatarUrl } from "@/lib/avatar";
import { TH_MONTHS } from "@/lib/format";
import {
  ALL_CATEGORIES,
  NO_CATEGORY,
  type ActivityHeatmap,
  type HeatmapMember,
} from "@/lib/activityHeatmap";

/* แดชบอร์ดทีม — the reads behind the ทีม tab.
 *
 * ── A TEAM IS `teams` + `main_1_hr.team_id` ─────────────────────────────────────
 * Not "everyone the viewer can see". The CEO can see everyone, and a scoreboard of
 * everyone would silently include back-office staff with no revenue and no target. The
 * team is the thing the CEO named in ตั้งค่า ▸ ทีม, and the tab shows exactly its members.
 * Ben, 2026-09-16: one team, ทีมขาย, the six sales columns of his sheet.
 *
 * ── ONE RPC FOR ALL OF THEM ─────────────────────────────────────────────────────
 * `dash_revenue_by_agent` returns every member's signed commission per month in one
 * call. Six calls to the per-person RPC would give the same numbers, twice per render
 * (this range and the previous one), and the trend would make it eighteen.
 *
 * ── THE TEAM TOTAL IS THE SUM OF SHARES ─────────────────────────────────────────
 * A co-broke case appears once per agent with that agent's share, so summing the
 * members' rows gives the case's full commission once — not twice. Only a share held
 * by someone OUTSIDE the team (an external partner's row) is left out, and it should
 * be: it is not this team's money.
 *
 * ── THE TARGET IS THE TEAM'S, THE % IS EACH PERSON'S ────────────────────────────
 * Two different questions. "Are we on ฿3M" reads team_revenue_targets. "Is Pup on her
 * own number" reads Pup's row in `targets`, the same one her own dashboard uses, so the
 * two pages cannot disagree about her. Same resolution rule as everywhere else: a row
 * for this exact period beats the standing row, nothing is pro-rated.
 */

export interface TeamOption {
  id: string;
  name: string;
  leaderCode: string | null;
  memberCodes: string[];
}

/**
 * The teams this viewer may open — every team with at least one member they can see.
 * `visible_employee_codes()` is the same scope the RLS uses, so the CEO gets every team
 * and a leader with `performance.view_team` gets their own.
 */
export async function getVisibleTeams(): Promise<TeamOption[]> {
  const supabase = await createClient();
  const [teams, members, visible] = await Promise.all([
    supabase.from("teams").select("id,name,leader_code,sort_order").order("sort_order"),
    supabase.from("main_1_hr").select("employee_code,team_id").not("team_id", "is", null),
    supabase.rpc("visible_employee_codes"),
  ]);

  const visibleSet = new Set(
    ((visible.data ?? []) as (string | { visible_employee_codes: string })[]).map((v) =>
      typeof v === "string" ? v : v.visible_employee_codes
    )
  );
  const byTeam = new Map<string, string[]>();
  for (const m of (members.data ?? []) as { employee_code: string; team_id: string }[]) {
    byTeam.set(m.team_id, [...(byTeam.get(m.team_id) ?? []), m.employee_code]);
  }

  return ((teams.data ?? []) as { id: string; name: string; leader_code: string | null }[])
    .map((t) => ({
      id: t.id,
      name: t.name,
      leaderCode: t.leader_code,
      memberCodes: (byTeam.get(t.id) ?? []).sort(),
    }))
    .filter((t) => t.memberCodes.some((c) => visibleSet.has(c)));
}

export interface AgentRevenue {
  code: string;
  nickname: string;
  /** Profile photo URL, or null for initials. */
  avatarUrl: string | null;
  actual: number;
  cases: number;
  /** This person's OWN official target for the range, 0 when none is set. */
  target: number;
}

export interface TeamRevenueSummary extends RevenueSummary {
  /** Every member, best first. Members with nothing signed are still listed — a team
      table that hides the quiet ones is not a team table. */
  agents: AgentRevenue[];
  /** Leads received in the window and assigned to a member. */
  newLeads: number;
}

type AgentMonth = { employee_code: string; month: string; total: number; cases: number };

async function readByAgent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  codes: string[],
  from: string,
  to: string,
  basis: RevenueBasis
): Promise<AgentMonth[]> {
  if (codes.length === 0) return [];
  const { data, error } = await supabase.rpc("dash_revenue_by_agent", {
    p_codes: codes,
    p_from: from,
    p_to: to,
    p_basis: basis,
  });
  if (error || !data) return [];
  return (data as AgentMonth[]).map((r) => ({
    employee_code: r.employee_code,
    month: r.month,
    total: Number(r.total ?? 0),
    cases: Number(r.cases ?? 0),
  }));
}

/** Override beats standing; the standing figure is scaled only for a custom window. */
function resolveTarget(
  rows: { period_key: string; target: number }[],
  key: string,
  range: Range
): { amount: number; isOverride: boolean } {
  const override = rows.find((r) => r.period_key === key);
  const standing = rows.find((r) => r.period_key === "");
  const base = Number((override ?? standing)?.target ?? 0);
  return { amount: base * periodMultiple(range), isOverride: !!override };
}

/** The team's signed commission in the window, member by member, against its target. */
async function loadTeamRevenueSummary(
  team: TeamOption,
  range: Range,
  basis: RevenueBasis
): Promise<TeamRevenueSummary> {
  const supabase = await createClient();
  const codes = team.memberCodes;
  const key = periodKeyOf(range);

  const [now, before, teamTargetRes, agentTargetRes, peopleRes, leadsRes] = await Promise.all([
    readByAgent(supabase, codes, range.start, range.end, basis),
    range.prev ? readByAgent(supabase, codes, range.prev.start, range.prev.end, basis) : null,
    supabase
      .from("team_revenue_targets")
      .select("period_key,target")
      .eq("team_id", team.id)
      .eq("period", range.period)
      .in("period_key", ["", key]),
    codes.length
      ? supabase
          .from("targets")
          .select("employee_code,period_key,target")
          .in("employee_code", codes)
          .eq("owner", "official")
          .eq("source", "revenue")
          .eq("period", range.period)
          .in("period_key", ["", key])
      : null,
    codes.length
      ? supabase.from("main_1_hr").select("employee_code,nickname,avatar_path").in("employee_code", codes)
      : null,
    codes.length
      ? supabase
          .from("main_6_buyer_crm")
          .select("lead_id", { count: "exact", head: true })
          .in("sale_id", codes)
          .gte("date_received", range.start)
          .lte("date_received", range.end)
      : null,
  ]);

  const sum = (rows: AgentMonth[]) =>
    rows.reduce((acc, r) => ({ total: acc.total + r.total, cases: acc.cases + r.cases }), { total: 0, cases: 0 });

  const byCode = new Map<string, { actual: number; cases: number }>();
  for (const r of now) {
    const cur = byCode.get(r.employee_code) ?? { actual: 0, cases: 0 };
    byCode.set(r.employee_code, { actual: cur.actual + r.total, cases: cur.cases + r.cases });
  }

  const targetRows = new Map<string, { period_key: string; target: number }[]>();
  for (const r of ((agentTargetRes?.data ?? []) as { employee_code: string; period_key: string; target: number }[])) {
    targetRows.set(r.employee_code, [...(targetRows.get(r.employee_code) ?? []), r]);
  }
  const people = new Map(
    ((peopleRes?.data ?? []) as {
      employee_code: string;
      nickname: string | null;
      avatar_path: string | null;
    }[]).map((p) => [
      p.employee_code,
      { nickname: p.nickname || p.employee_code, avatarUrl: avatarUrl(p.avatar_path) },
    ])
  );

  const agents: AgentRevenue[] = codes
    .map((code) => {
      const got = byCode.get(code) ?? { actual: 0, cases: 0 };
      const person = people.get(code);
      return {
        code,
        nickname: person?.nickname ?? code,
        avatarUrl: person?.avatarUrl ?? null,
        actual: got.actual,
        cases: got.cases,
        target: resolveTarget(targetRows.get(code) ?? [], key, range).amount,
      };
    })
    .sort((a, b) => b.actual - a.actual || a.nickname.localeCompare(b.nickname, "th"));

  const total = sum(now);
  const teamTarget = resolveTarget(
    (teamTargetRes.data ?? []) as { period_key: string; target: number }[],
    key,
    range
  );

  return {
    actual: total.total,
    previous: before ? sum(before).total : null,
    cases: total.cases,
    target: teamTarget.amount,
    targetPeriod: range.period,
    targetIsOverride: teamTarget.isOverride,
    basis,
    elapsed: range.elapsed,
    agents,
    newLeads: leadsRes?.count ?? 0,
  };
}

/* Memoised per request. The ทีม tab reads this summary from TWO Suspense blocks now —
   the tiles and target card in one, the leaderboard beside the trend in the other — and
   they resolve independently. Without `cache()` that is the same set of RPCs twice.
   Same mechanism getAuthContext and getOverdueFollowUps use. */
export const getTeamRevenueSummary = cache(loadTeamRevenueSummary);

/** The team's monthly signed commission, oldest first, gaps filled with zero — the same
    continuous series rule as the per-person trend (see getRevenueTrend). */
export async function getTeamRevenueTrend(
  codes: string[],
  basis: RevenueBasis,
  months = 12
): Promise<TrendPoint[]> {
  const supabase = await createClient();
  const today = todayISO();
  const endIdx = Number(today.slice(0, 4)) * 12 + (Number(today.slice(5, 7)) - 1);
  const startIdx = endIdx - (months - 1);
  const keyOf = (idx: number) => `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;

  const rows = await readByAgent(supabase, codes, `${keyOf(startIdx)}-01`, today, basis);
  const byMonth = new Map<string, { revenue: number; cases: number }>();
  for (const r of rows) {
    const cur = byMonth.get(r.month) ?? { revenue: 0, cases: 0 };
    byMonth.set(r.month, { revenue: cur.revenue + r.total, cases: cur.cases + r.cases });
  }
  return Array.from({ length: months }, (_, i) => {
    const month = keyOf(startIdx + i);
    const hit = byMonth.get(month);
    return { month, revenue: hit?.revenue ?? 0, cases: hit?.cases ?? 0 };
  });
}

/** Every standing team target keyed by period length — what the inline editor loads.
    Unscaled, for the same reason as the per-person version. */
export async function getStandingTeamRevenueTargets(teamId: string): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("team_revenue_targets")
    .select("period,target")
    .eq("team_id", teamId)
    .eq("period_key", "");
  if (error || !data) return {};
  return Object.fromEntries(data.map((r) => [r.period as string, Number(r.target ?? 0)]));
}

/* ---------- กิจกรรมรายวัน (activity heatmap) -------------------------------------- */

/**
 * The team's logged work as a day × person grid, for ONE CALENDAR MONTH.
 *
 * ── WHY A MONTH AND NOT THE RANGE ───────────────────────────────────────────────
 * Every other card on this tab honours the range bar. This one cannot: ปีนี้ is 365 rows
 * and ไตรมาสนี้ is 90. So it shows the month CONTAINING `range.end`, the same convention
 * HAUS V2's overview used, and it prints that month in its header so the mismatch is
 * stated rather than silently absorbed.
 *
 * ── EVERY MEMBER, INCLUDING THE QUIET ONES ──────────────────────────────────────
 * Same rule as TeamAgentsTable. An empty column is the fact a leader most needs;
 * dropping it would turn the grid into a list of the people who were already fine.
 */
export async function getTeamActivityHeatmap(team: TeamOption, range: Range): Promise<ActivityHeatmap> {
  const monthKey = range.end.slice(0, 7);
  const [y, m] = monthKey.split("-").map(Number);
  // Day 0 of the NEXT month is the last day of this one. UTC throughout: these are
  // calendar dates, and a local-time Date would shift them a day either side of midnight.
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const monthStart = `${monthKey}-01`;
  const monthEnd = `${monthKey}-${String(daysInMonth).padStart(2, "0")}`;

  const iso = todayISO();
  const today = iso.slice(0, 7) === monthKey ? Number(iso.slice(8, 10)) : null;

  const base: ActivityHeatmap = {
    monthKey,
    monthLabel: `${TH_MONTHS[m - 1]} ${y}`,
    daysInMonth,
    today,
    members: [],
    categories: [{ key: ALL_CATEGORIES, label: "ทั้งหมด" }],
    peak: {},
  };

  const codes = team.memberCodes;
  if (codes.length === 0) return base;

  const supabase = await createClient();
  const [grid, people, cats] = await Promise.all([
    supabase.rpc("dash_activity_heatmap", { p_codes: codes, p_from: monthStart, p_to: monthEnd }),
    supabase.from("main_1_hr").select("employee_code,nickname,avatar_path").in("employee_code", codes),
    supabase.from("action_category").select("name,sort_order").order("sort_order"),
  ]);

  // A failed read is not an empty month and must not be drawn as one. The caller renders
  // the same "no activity" state either way, so the distinction is logged rather than
  // thrown — one unreadable card should not blank the whole tab.
  if (grid.error) console.error("dash_activity_heatmap:", grid.error.message);

  const identity = new Map(
    ((people.data ?? []) as { employee_code: string; nickname: string | null; avatar_path: string | null }[]).map(
      (p) => [p.employee_code, { nickname: p.nickname || p.employee_code, avatarUrl: avatarUrl(p.avatar_path) }]
    )
  );

  const byCode = new Map<string, HeatmapMember>(
    codes.map((code) => [
      code,
      {
        code,
        nickname: identity.get(code)?.nickname ?? code,
        avatarUrl: identity.get(code)?.avatarUrl ?? null,
        days: Array.from({ length: daysInMonth }, () => ({}) as Record<string, number>),
        totals: {},
      },
    ])
  );

  const add = (bag: Record<string, number>, key: string, n: number) => {
    bag[key] = (bag[key] ?? 0) + n;
  };

  let sawUncategorised = false;
  for (const r of (grid.data ?? []) as { employee_code: string; day: string; category: string; total: number }[]) {
    const member = byCode.get(r.employee_code);
    if (!member) continue;
    const cell = member.days[Number(r.day.slice(8, 10)) - 1];
    if (!cell) continue;
    const key = r.category ?? NO_CATEGORY;
    if (key === NO_CATEGORY) sawUncategorised = true;
    const n = Number(r.total ?? 0);
    add(cell, key, n);
    add(cell, ALL_CATEGORIES, n);
    add(member.totals, key, n);
    add(member.totals, ALL_CATEGORIES, n);
  }

  // Read AFTER the grid is filled: a day carries several categories, and the biggest cell
  // for ทั้งหมด is the summed day, not the biggest single row the RPC returned.
  const peak: Record<string, number> = {};
  for (const member of byCode.values()) {
    for (const cell of member.days) {
      for (const [key, n] of Object.entries(cell)) peak[key] = Math.max(peak[key] ?? 0, n);
    }
  }

  const governed = ((cats.data ?? []) as { name: string }[]).map((c) => ({ key: c.name, label: c.name }));

  return {
    ...base,
    members: [...byCode.values()].sort(
      (a, b) =>
        (b.totals[ALL_CATEGORIES] ?? 0) - (a.totals[ALL_CATEGORIES] ?? 0) ||
        a.nickname.localeCompare(b.nickname, "th")
    ),
    // ไม่ระบุ appears only when something is actually unfiled — a permanent pill reading
    // zero would be a standing accusation that the settings are incomplete when they are not.
    categories: [
      ...base.categories,
      ...governed,
      ...(sawUncategorised ? [{ key: NO_CATEGORY, label: "ไม่ระบุ" }] : []),
    ],
    peak,
  };
}

/* ---------- KPI ทีมขาย ------------------------------------------------------------ */

/* The HAUS V2 sales-process KPI model, on this app's tables. Ben, 2026-09-17: adopt it
 * as-is — the CEO will run these KPIs for a while.
 *
 * TWO SHAPES, and the difference is the whole design:
 *   count  done against a CEO-set target.      Displayed "7/10".
 *   pct    a share of a population.            Displayed "38%". Target is always 100%,
 *          so there is nothing for the CEO to set.
 *
 * NOT TRACKED IS NOT ZERO. A count KPI with no target for someone is rendered muted as
 * "7/–" and excluded from every average — never as "7/0 · 0%", which reads as failure
 * rather than as unmeasured. HAUS V2's rule, and the right one: empty over fake zeros.
 *
 * THE LIST IS DATA. Which metrics are KPIs, their shape, their focus week and their order
 * all come from `kpi_template` where `on_tracker`. Nothing here names a KPI.
 */
export type KpiShape = "count" | "pct";

/** The closed set of population shares. Each needs its own query, so a new one is a code
    change by definition — which is why this is a union and not a lookup table. */
export type PctMetric = "owner_talk" | "buyer_follow";

export interface KpiAgentRow {
  code: string;
  nickname: string;
  avatarUrl: string | null;
  done: number;
  /** count → this person's target. pct → the size of their population. 0 = not tracked. */
  denom: number;
  /** 0–100, capped. Null when not tracked — there is nothing to be a percentage of. */
  pct: number | null;
  /** "7/10" · "38%" · "7/–" — one string so the card never re-derives the shape rule. */
  text: string;
}

export interface TeamKpi {
  key: string;
  label: string;
  shape: KpiShape;
  /** 1–4, the week of the month this KPI is the team's focus. Null = no rhythm set. */
  focusWeek: number | null;
  /** This KPI's week is the week we are in — and only ever true on the current month. */
  isFocus: boolean;
  /** What the number counts, in one line. */
  hint: string;
  rows: KpiAgentRow[];
  /** Totals over the TRACKED rows only, for the same reason they are excluded above. */
  done: number;
  denom: number;
  tracked: number;
}

/* Week of the month: 1–7 = w1, 8–14 = w2, 15–21 = w3, 22+ = w4. HAUS V2's currentWeek(),
   unchanged — a fixed 7-day cut, not an ISO week, so the month always has exactly four. */
export function weekOfMonth(iso: string): number {
  const d = Number(iso.slice(8, 10));
  return d <= 7 ? 1 : d <= 14 ? 2 : d <= 21 ? 3 : 4;
}

const COUNT_HINT: Record<string, string> = {
  activity: "นับจากกิจกรรมที่บันทึก",
  stage: "นับจากลีดที่รับเข้ามาในช่วงนี้ และไปถึงขั้นนี้",
  owner_stage: "นับจากทรัพย์ที่รับเข้ามาในช่วงนี้ และไปถึงขั้นนี้",
};

const PCT_HINT: Record<PctMetric, string> = {
  owner_talk: "สัดส่วนทรัพย์ที่ยังขายอยู่ ซึ่งคุยกับเจ้าของแล้วในช่วงนี้",
  buyer_follow: "สัดส่วนลีดที่ยังเปิดอยู่ ซึ่งติดตามแล้วในช่วงนี้",
};

interface KpiDef {
  id: number;
  label: string;
  shape: KpiShape;
  source: string;
  activityType: string | null;
  stageName: string | null;
  ownerStageName: string | null;
  pctMetric: PctMetric | null;
  focusWeek: number | null;
  sort: number;
}

/**
 * Every KPI on the tracker, with each member's standing.
 *
 * ── TARGET RESOLUTION IS THE ONE USED EVERYWHERE ────────────────────────────────
 * `official` only, override beats standing, nothing pro-rated — the rules getWorkTargets
 * follows for one person, applied to six. A stretch goal must never become the bar
 * somebody is scored on in front of their team.
 *
 * ── THE FOCUS WEEK ONLY LIGHTS UP ON THE CURRENT MONTH ──────────────────────────
 * Highlighting week 2 while reading เมษายน would be pointing at a rhythm that finished
 * months ago. HAUS V2 draws the same line.
 */
export async function getTeamKpiProgress(team: TeamOption, range: Range): Promise<TeamKpi[]> {
  const codes = team.memberCodes;
  if (codes.length === 0) return [];

  const supabase = await createClient();
  const periodKey = periodKeyOf(range);
  const iso = todayISO();
  const onCurrentMonth = range.end.slice(0, 7) === iso.slice(0, 7);
  const thisWeek = weekOfMonth(iso);

  const [defsRes, goalsRes, countsRes, coverRes, peopleRes] = await Promise.all([
    supabase
      .from("kpi_template")
      .select("id,label,shape,source,activity_type,stage_name,owner_stage_name,pct_metric,focus_week,sort")
      .eq("on_tracker", true)
      .order("sort"),
    supabase
      .from("targets")
      .select("employee_code,source,activity_type,stage_name,owner_stage_name,period_key,target")
      .in("employee_code", codes)
      .eq("owner", "official")
      .is("month", null)
      .in("source", ["activity", "stage", "owner_stage"])
      .eq("period", range.period)
      .in("period_key", ["", periodKey]),
    supabase.rpc("dash_team_kpi", { p_codes: codes, p_from: range.start, p_to: range.end }),
    supabase.rpc("dash_team_coverage", { p_codes: codes, p_from: range.start, p_to: range.end }),
    supabase.from("main_1_hr").select("employee_code,nickname,avatar_path").in("employee_code", codes),
  ]);

  if (countsRes.error) console.error("dash_team_kpi:", countsRes.error.message);
  if (coverRes.error) console.error("dash_team_coverage:", coverRes.error.message);
  if (defsRes.error || !defsRes.data) return [];

  const defs: KpiDef[] = (defsRes.data as Record<string, unknown>[]).map((d) => ({
    id: Number(d.id),
    label: String(d.label),
    shape: (d.shape === "pct" ? "pct" : "count") as KpiShape,
    source: String(d.source ?? "activity"),
    activityType: (d.activity_type as string | null) ?? null,
    stageName: (d.stage_name as string | null) ?? null,
    ownerStageName: (d.owner_stage_name as string | null) ?? null,
    pctMetric: (d.pct_metric as PctMetric | null) ?? null,
    focusWeek: d.focus_week == null ? null : Number(d.focus_week),
    sort: Number(d.sort ?? 0),
  }));

  const identity = new Map(
    ((peopleRes.data ?? []) as { employee_code: string; nickname: string | null; avatar_path: string | null }[]).map(
      (p) => [p.employee_code, { nickname: p.nickname || p.employee_code, avatarUrl: avatarUrl(p.avatar_path) }]
    )
  );

  const counted = new Map<string, number>();
  for (const r of (countsRes.data ?? []) as { employee_code: string; source: string; metric: string; done: number }[]) {
    counted.set(`${r.employee_code}|${r.source}|${r.metric}`, Number(r.done ?? 0));
  }
  const coverage = new Map<string, { done: number; total: number }>();
  for (const r of (coverRes.data ?? []) as { employee_code: string; metric: string; done: number; total: number }[]) {
    coverage.set(`${r.employee_code}|${r.metric}`, { done: Number(r.done ?? 0), total: Number(r.total ?? 0) });
  }

  const multiple = periodMultiple(range);
  const standing = new Map<string, number>();
  const override = new Map<string, number>();
  for (const g of (goalsRes.data ?? []) as {
    employee_code: string;
    source: string;
    activity_type: string | null;
    stage_name: string | null;
    owner_stage_name: string | null;
    period_key: string;
    target: number;
  }[]) {
    const metric = g.activity_type ?? g.stage_name ?? g.owner_stage_name;
    if (!metric) continue;
    const k = `${g.employee_code}|${g.source}|${metric}`;
    (g.period_key === "" ? standing : override).set(k, Number(g.target ?? 0));
  }

  const out: TeamKpi[] = defs.map((def) => {
    const metric = def.activityType ?? def.stageName ?? def.ownerStageName ?? "";
    const rows: KpiAgentRow[] = codes.map((code) => {
      const person = identity.get(code);
      const base = {
        code,
        nickname: person?.nickname ?? code,
        avatarUrl: person?.avatarUrl ?? null,
      };

      if (def.shape === "pct") {
        const c = def.pctMetric ? coverage.get(`${code}|${def.pctMetric}`) : undefined;
        const total = c?.total ?? 0;
        // No population is not 0% — somebody with no open leads has not failed to follow
        // any up. Untracked, and out of the average.
        if (total <= 0) return { ...base, done: 0, denom: 0, pct: null, text: "–" };
        const done = c?.done ?? 0;
        const pct = Math.min(100, Math.round((done / total) * 100));
        return { ...base, done, denom: total, pct, text: `${pct}%` };
      }

      const k = `${code}|${def.source}|${metric}`;
      const done = counted.get(k) ?? 0;
      const target = (override.get(k) ?? standing.get(k) ?? 0) * multiple;
      if (target <= 0) return { ...base, done, denom: 0, pct: null, text: `${done}/–` };
      return {
        ...base,
        done,
        denom: target,
        pct: Math.min(100, Math.round((done / target) * 100)),
        text: `${done}/${target}`,
      };
    });

    // Tracked first and best first inside that; the untracked tail keeps name order so it
    // reads as a list of people to set a target for, not as a ranking of failures.
    rows.sort((a, b) => {
      if ((a.pct == null) !== (b.pct == null)) return a.pct == null ? 1 : -1;
      if (a.pct != null && b.pct != null && a.pct !== b.pct) return b.pct - a.pct;
      return a.nickname.localeCompare(b.nickname, "th");
    });

    const tracked = rows.filter((r) => r.pct != null);
    return {
      key: `kpi-${def.id}`,
      label: def.label,
      shape: def.shape,
      focusWeek: def.focusWeek,
      isFocus: onCurrentMonth && def.focusWeek === thisWeek,
      hint: def.shape === "pct"
        ? (def.pctMetric ? PCT_HINT[def.pctMetric] : "")
        : (COUNT_HINT[def.source] ?? ""),
      rows,
      done: tracked.reduce((s, r) => s + r.done, 0),
      denom: tracked.reduce((s, r) => s + r.denom, 0),
      tracked: tracked.length,
    };
  });

  /* Ordered by focus week, so the card always reads left-to-right as the month's rhythm
     even after the CEO reshuffles the weeks. Ties keep the stored sort. A KPI with no week
     goes last rather than pretending to be week 1. */
  return out.sort((a, b) => (a.focusWeek ?? 99) - (b.focusWeek ?? 99));
}
