// SAMPLE DATA + logic — the analytics Dashboard layer, ported from the HAUS V2 sales
// dashboard (Google-Sheets "summary_*" tabs). Design-first: the shapes here mirror the
// eventual Supabase rollup (materialized views or a nightly summary table), so wiring is
// a swap of the data source, not a rewrite. Everything reconciles: the revenue trend sums
// to the leaderboard sums to the hero total, exactly like the source dashboard.
//
// Two metric kinds (the core distinction, same as HAUS V2):
//   • FLOW    — accumulates over time (revenue, closed, new leads/listings, actions).
//               Summed across the selected months → obeys the month-range picker.
//   • SNAPSHOT— "as of now" (active buyers/listings, A-list, overdue). Ignores the picker.
//
// Wiring map (Supabase):
//   monthly flow      → v_summary_overview_monthly (agent, month, revenue, closed_count, …)
//   snapshot          → v_sale_status / live counts over main_6_buyer_crm + v_main_listing
//   kpi               → v_summary_kpi (ownertalk_done/total, sourcing_done/target, …)
//   monthly actions   → v_summary_activity_monthly (agent, month, <action cols>)
//   daily activity    → v_summary_heatmap_daily (agent, day, count) — for the heatmap
//   team revenue goal → CEO targets tab (summary_targets.team per month)
// Join key: rows key agents by nickname here; real rows key by sale_id/code — join
// sale_id → employees.code → employees.nickname at wiring.

// ── Stubbed "now" (design-stable; swap for a real clock at wiring) ───────────
export const DASH_MONTH = "2026-07"; // current month
export const DASH_DAY = 18; // day-of-month, for the month-to-date pace projection
export const DASH_DAYS_IN_MONTH = 31;

// Months that have data, ascending (Jan–Jul 2026). Jul is the current, partial month.
export const DASH_MONTHS = [
  "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07",
];

const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

/** Short label for a month key, e.g. "ก.ค." (year dropped — single calendar year). */
export function monthShort(key: string): string {
  const m = Number(key.slice(5, 7));
  return TH_MONTH[m - 1] ?? key;
}

// ── Roster (matches the HAUS V2 dashboard: the six selling agents) ───────────
export const DASH_AGENTS = ["Stone", "Pup", "Game", "Q", "Mhow", "Golf"] as const;
export type DashAgent = (typeof DASH_AGENTS)[number];

// ── Range presets (drive the month-range picker) ─────────────────────────────
export type RangeId = "this" | "3m" | "6m" | "ytd";
export const RANGE_PRESETS: { id: RangeId; label: string }[] = [
  { id: "this", label: "เดือนนี้" },
  { id: "3m", label: "3 เดือน" },
  { id: "6m", label: "6 เดือน" },
  { id: "ytd", label: "ปีนี้" },
];

/** Month keys included in a range preset (ascending), clamped to available data. */
export function monthsInRange(id: RangeId): string[] {
  const end = DASH_MONTHS.indexOf(DASH_MONTH);
  if (id === "ytd") return DASH_MONTHS.slice(0, end + 1);
  const span = id === "this" ? 1 : id === "3m" ? 3 : 6;
  return DASH_MONTHS.slice(Math.max(0, end - span + 1), end + 1);
}

/** Compact Thai label for a range, e.g. "ก.ค." or "พ.ค.–ก.ค.". */
export function rangeLabel(id: RangeId): string {
  const ms = monthsInRange(id);
  if (ms.length <= 1) return monthShort(ms[0] ?? DASH_MONTH);
  return `${monthShort(ms[0])}–${monthShort(ms[ms.length - 1])}`;
}

// ── Deterministic sample generator (stable across renders / SSR — no Math.random) ──
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function rand01(s: string): number {
  // mulberry32 on the string hash
  let t = (hash(s) + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function randInt(s: string, min: number, max: number): number {
  return min + Math.floor(rand01(s) * (max - min + 1));
}

// ── FLOW: monthly revenue (฿, closed deal value) per agent ───────────────────
// Jan–Jun are complete months; Jul (index 6) is month-to-date (day 18/31).
// Millions of baht. Team full months ≈ 13–16M against a 12M goal → mostly ahead.
const REV_M: Record<DashAgent, number[]> = {
  Stone: [3.8, 4.1, 3.5, 4.6, 4.2, 4.9, 2.4],
  Pup:   [2.9, 3.2, 3.6, 3.0, 3.4, 3.8, 1.7],
  Game:  [2.2, 2.0, 2.6, 2.8, 2.5, 2.9, 1.4],
  Q:     [1.7, 2.1, 1.9, 2.3, 2.0, 2.4, 1.0],
  Mhow:  [1.4, 1.2, 1.6, 1.5, 1.8, 1.7, 0.8],
  Golf:  [0.9, 1.1, 1.0, 1.3, 1.2, 1.5, 0.5],
};
const AVG_TICKET = 1_800_000; // ฿ per closed unit — derive closed_count from revenue

export interface MonthlyFlow {
  agent: DashAgent;
  month: string;
  revenue: number;
  closed_count: number;
  new_leads: number;
  new_listings: number;
}

/** Full monthly-flow table (agent × month). Wiring: v_summary_overview_monthly. */
export const MONTHLY_FLOW: MonthlyFlow[] = DASH_AGENTS.flatMap((agent) =>
  DASH_MONTHS.map((month, i) => {
    const revenue = Math.round((REV_M[agent][i] ?? 0) * 1_000_000);
    return {
      agent,
      month,
      revenue,
      closed_count: Math.round(revenue / AVG_TICKET),
      new_leads: randInt(`${agent}:${month}:leads`, 3, 12),
      new_listings: randInt(`${agent}:${month}:list`, 1, 5),
    };
  })
);

/** Sum flow fields for one agent (or the whole team) across month keys. */
export function sumFlow(
  agent: DashAgent | "all",
  months: string[],
  fields: (keyof Pick<MonthlyFlow, "revenue" | "closed_count" | "new_leads" | "new_listings">)[]
): Record<string, number> {
  const want = new Set(months);
  const out: Record<string, number> = Object.fromEntries(fields.map((f) => [f, 0]));
  for (const r of MONTHLY_FLOW) {
    if (agent !== "all" && r.agent !== agent) continue;
    if (!want.has(r.month)) continue;
    for (const f of fields) out[f] += r[f];
  }
  return out;
}

/** Team (or agent) revenue per month across a range — for the trend chart. */
export function revenueSeries(agent: DashAgent | "all", months: string[]): { month: string; revenue: number }[] {
  return months.map((month) => ({
    month,
    revenue: sumFlow(agent, [month], ["revenue"]).revenue,
  }));
}

// ── CEO team revenue goal per month (summary_targets.team) ────────────────────
export const TEAM_GOAL_MONTHLY = 12_000_000;
export function teamGoal(months: string[]): number {
  return months.length * TEAM_GOAL_MONTHLY;
}

// ── SNAPSHOT: "as of now" per agent (ignores the picker) ─────────────────────
export interface AgentSnapshot {
  agent: DashAgent;
  active_buyers: number;
  active_listings: number;
  active_alist: number; // A-grade listings currently active
  overdue_leads: number; // leads not followed in >2 days
}
const SNAP: Record<DashAgent, Omit<AgentSnapshot, "agent">> = {
  Stone: { active_buyers: 24, active_listings: 18, active_alist: 6, overdue_leads: 2 },
  Pup:   { active_buyers: 19, active_listings: 22, active_alist: 8, overdue_leads: 0 },
  Game:  { active_buyers: 15, active_listings: 14, active_alist: 4, overdue_leads: 3 },
  Q:     { active_buyers: 13, active_listings: 11, active_alist: 3, overdue_leads: 1 },
  Mhow:  { active_buyers: 10, active_listings: 9, active_alist: 2, overdue_leads: 0 },
  Golf:  { active_buyers: 8, active_listings: 7, active_alist: 2, overdue_leads: 4 },
};
export function snapshot(agent: DashAgent): AgentSnapshot {
  return { agent, ...SNAP[agent] };
}
export function teamSnapshot(): { active_buyers: number; active_listings: number; active_alist: number; overdue_leads: number } {
  return DASH_AGENTS.reduce(
    (a, ag) => {
      const s = SNAP[ag];
      a.active_buyers += s.active_buyers;
      a.active_listings += s.active_listings;
      a.active_alist += s.active_alist;
      a.overdue_leads += s.overdue_leads;
      return a;
    },
    { active_buyers: 0, active_listings: 0, active_alist: 0, overdue_leads: 0 }
  );
}

// ── KPI: the 4 sales-process KPIs per agent (current month) ──────────────────
// Mirrors summary_kpi. Owner Talk + Buyer Follow are ratios (done/total → %);
// Sourcing + Survey are counts (done/target). Same contract as lib/momentum ratio KPIs.
export interface AgentKpi {
  agent: DashAgent;
  ownertalk_done: number; ownertalk_total: number;
  sourcing_done: number; sourcing_target: number;
  survey_done: number; survey_target: number;
  buyerfollow_done: number; buyerfollow_total: number;
}
const KPI: Record<DashAgent, Omit<AgentKpi, "agent">> = {
  Stone: { ownertalk_done: 9, ownertalk_total: 12, sourcing_done: 6, sourcing_target: 10, survey_done: 5, survey_target: 8, buyerfollow_done: 22, buyerfollow_total: 30 },
  Pup:   { ownertalk_done: 11, ownertalk_total: 12, sourcing_done: 8, sourcing_target: 10, survey_done: 7, survey_target: 8, buyerfollow_done: 26, buyerfollow_total: 30 },
  Game:  { ownertalk_done: 7, ownertalk_total: 12, sourcing_done: 9, sourcing_target: 10, survey_done: 4, survey_target: 8, buyerfollow_done: 18, buyerfollow_total: 28 },
  Q:     { ownertalk_done: 6, ownertalk_total: 10, sourcing_done: 5, sourcing_target: 10, survey_done: 6, survey_target: 8, buyerfollow_done: 15, buyerfollow_total: 24 },
  Mhow:  { ownertalk_done: 8, ownertalk_total: 10, sourcing_done: 4, sourcing_target: 8, survey_done: 3, survey_target: 6, buyerfollow_done: 12, buyerfollow_total: 20 },
  Golf:  { ownertalk_done: 4, ownertalk_total: 9, sourcing_done: 3, sourcing_target: 8, survey_done: 2, survey_target: 6, buyerfollow_done: 9, buyerfollow_total: 18 },
};
export function agentKpi(agent: DashAgent): AgentKpi {
  return { agent, ...KPI[agent] };
}

/** KPI definitions + weekly-focus rhythm (which KPI leadership pushes each week). */
export type KpiFormat = "ratio" | "count";
export interface KpiDef {
  id: "ownertalk" | "sourcing" | "survey" | "buyerfollow";
  label: string;
  format: KpiFormat;
  doneKey: keyof AgentKpi;
  denomKey: keyof AgentKpi;
  focusWeek: [number, number];
  focusLabel: string;
}
export const KPI_DEFS: KpiDef[] = [
  { id: "ownertalk", label: "Owner Talk", format: "ratio", doneKey: "ownertalk_done", denomKey: "ownertalk_total", focusWeek: [1, 1], focusLabel: "สัปดาห์ 1" },
  { id: "sourcing", label: "Sourcing", format: "count", doneKey: "sourcing_done", denomKey: "sourcing_target", focusWeek: [2, 3], focusLabel: "สัปดาห์ 2-3" },
  { id: "survey", label: "Survey", format: "count", doneKey: "survey_done", denomKey: "survey_target", focusWeek: [2, 3], focusLabel: "สัปดาห์ 2-3" },
  { id: "buyerfollow", label: "Buyer Follow", format: "ratio", doneKey: "buyerfollow_done", denomKey: "buyerfollow_total", focusWeek: [4, 4], focusLabel: "สัปดาห์ 4" },
];

/** Derive { done, denom, pct, text } for one agent + KPI. */
export function kpiValue(k: AgentKpi, def: KpiDef): { done: number; denom: number; pct: number; text: string } {
  const done = Number(k[def.doneKey] || 0);
  const denom = Number(k[def.denomKey] || 0);
  const pct = denom > 0 ? Math.min(100, Math.round((done / denom) * 100)) : 0;
  return { done, denom, pct, text: def.format === "count" ? `${done}/${denom}` : `${pct}%` };
}

/** Current week of the month (1–4) for the KPI focus highlight, from the stubbed clock. */
export function currentWeek(): number {
  if (DASH_DAY <= 7) return 1;
  if (DASH_DAY <= 14) return 2;
  if (DASH_DAY <= 21) return 3;
  return 4;
}
export function isFocusWeek(def: KpiDef, week = currentWeek()): boolean {
  return week >= def.focusWeek[0] && week <= def.focusWeek[1];
}

// ── ACTIONS: monthly activity breakdown per agent ────────────────────────────
// Mirrors summary_activity_monthly. Grouped owner-side / buyer-side / other.
export const ACTION_DEFS = {
  owner: [
    { key: "new_list", label: "New List" },
    { key: "visit", label: "Visit" },
    { key: "owner_talk", label: "Owner Talk" },
    { key: "sourcing", label: "Sourcing" },
    { key: "tidpai", label: "ติดป้าย" },
  ],
  buyer: [
    { key: "call", label: "Call" },
    { key: "follow", label: "Follow" },
    { key: "appoint", label: "Appoint" },
    { key: "showing", label: "Showing" },
    { key: "nego", label: "Nego" },
    { key: "close", label: "Close" },
  ],
  other: [
    { key: "survey", label: "Survey" },
    { key: "evaluate", label: "ประเมิน" },
    { key: "meeting", label: "ประชุม" },
    { key: "deskwork", label: "ทำงานหน้าคอม" },
    { key: "reels", label: "ถ่าย Reels" },
    { key: "other", label: "อื่นๆ" },
  ],
} as const;

export type ActionGroup = keyof typeof ACTION_DEFS;

/** Action count for one agent + action key, summed over months (deterministic sample). */
export function actionCount(agent: DashAgent, key: string, months: string[]): number {
  return months.reduce((sum, m) => sum + randInt(`${agent}:${m}:${key}`, 0, 9), 0);
}

/** Owner/buyer/other totals + per-action breakdown for an agent over a range. */
export function actionBreakdown(agent: DashAgent, months: string[]) {
  const build = (group: ActionGroup) =>
    ACTION_DEFS[group].map((a) => ({ key: a.key, label: a.label, count: actionCount(agent, a.key, months) }));
  const owner = build("owner");
  const buyer = build("buyer");
  const other = build("other");
  const sum = (arr: { count: number }[]) => arr.reduce((s, x) => s + x.count, 0);
  const ownerTotal = sum(owner);
  const buyerTotal = sum(buyer);
  const otherTotal = sum(other);
  return {
    owner, buyer, other,
    ownerTotal, buyerTotal, otherTotal,
    total: ownerTotal + buyerTotal + otherTotal,
  };
}

// ── DAILY ACTIVITY: per-agent day intensity for the heatmap (current month) ──
// Mirrors summary_heatmap_daily. Category-filterable (the HAUS heatmap splits activity by
// owner-side / buyer-side / survey / admin / company). Month-to-date only (future days = 0).
export const HEATMAP_CATEGORIES = [
  { id: "all", label: "ทั้งหมด" },
  { id: "owner", label: "ฝั่งเจ้าของ" },
  { id: "buyer", label: "ฝั่งผู้ซื้อ" },
  { id: "survey", label: "สำรวจ" },
  { id: "admin", label: "ธุรการ" },
  { id: "company", label: "บริษัท" },
] as const;
export type HeatCategory = (typeof HEATMAP_CATEGORIES)[number]["id"];

export function heatValue(agent: DashAgent, day: number, cat: HeatCategory = "all"): number {
  if (day > DASH_DAY) return 0; // month-to-date only
  const r = rand01(`${agent}:${DASH_MONTH}:d${day}:${cat}`);
  const restChance = cat === "all" ? 0.12 : 0.38; // sub-categories are sparser
  if (r < restChance) return 0;
  const scale = cat === "all" ? 8 : 5;
  return 1 + Math.floor(rand01(`${agent}:${DASH_MONTH}:d${day}:${cat}:n`) * scale);
}

/** Full current-month daily grid for one agent + category. */
export function dailySeries(agent: DashAgent, cat: HeatCategory = "all"): { day: number; count: number }[] {
  return Array.from({ length: DASH_DAYS_IN_MONTH }, (_, i) => ({ day: i + 1, count: heatValue(agent, i + 1, cat) }));
}
