import { createClient } from "@/lib/supabase/server";
import { periodKeyOf, periodMultiple, type Range } from "@/lib/range";
import { todayISO } from "@/lib/momentum";
import type { RevenueBasis } from "@/lib/deals";
import type { RevenueSummary, TrendPoint } from "@/lib/salesDashboard";
import { avatarUrl } from "@/lib/avatar";

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
export async function getTeamRevenueSummary(
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
