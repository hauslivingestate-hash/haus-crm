// การปิดการขาย — the closed-deal model. Types and pure helpers only (like lib/momentum.ts);
// lib/queries.ts reads, lib/mutations/deals.ts writes.
//
// ── WHY THIS EXISTS ─────────────────────────────────────────────────────────────
// Ben, 2026-09-06: "when they close the deal they have to inform sales support or admin
// in the old ways". The app never asked. `commission`, `closing_date` and `transfer_date`
// were READ (the leads grid, the lead detail page) and written by nobody — there was no
// screen in the product that could record a sale. Deals reached the database only because
// someone typed them into the spreadsheet and the spreadsheet was imported.
//
// ── THE SPLIT ───────────────────────────────────────────────────────────────────
// Two kinds of field, and the whole design turns on keeping them apart:
//
//   MANUAL   — only the sale who closed it knows this. Ask, and keep asking.
//   DERIVED  — already in the database. Never ask; a second copy is a second answer.
//
// `sale_id` is the example that made the rule: L26-007 has no sale on the lead, while the
// listing it closed on records C-001. The information was there; the form just asked the
// wrong person for it.
//
// ── SIGNED vs TRANSFERRED ───────────────────────────────────────────────────────
// `closing_date` is the contract; `transfer_date` is the land office. They are different
// events weeks apart, and both are real revenue answers to different questions — the sales
// scoreboard runs on signed, the money runs on transferred. A deal that is signed but not
// yet transferred is NOT incomplete: it is in progress. Treating a missing transfer_date as
// missing data would nag every healthy deal in the pipeline, which is how a reminder becomes
// something people learn to dismiss.

/** A grade of missing information, worst first. */
export type DealGap =
  /** Money is recorded but the deal was never dated — unauditable revenue. */
  | "closing_date"
  /** The number the commission was taken from. Nothing else in the DB records it. */
  | "closing_price"
  /** Dated, but no commission — the deal earns nothing on paper. */
  | "commission"
  /** A case marked SUCCESS with no transfer date — "the money arrived" with no when. */
  | "transfer_date"
  /** A case marked SUCCESS with no real figure — the forecast is standing in for cash. */
  | "real_revenue";

/** What each gap is called, and why it matters, for the reminder copy. */
export const DEAL_GAP_LABEL: Record<DealGap, string> = {
  closing_date: "วันที่ปิด",
  closing_price: "ราคาปิด",
  commission: "คอมมิชชั่น",
  transfer_date: "วันที่โอน",
  real_revenue: "ยอดที่ได้รับจริง",
};

/** The order gaps are reported in — a deal missing several leads with the worst. */
export const DEAL_GAPS: DealGap[] = ["closing_date", "closing_price", "commission", "transfer_date", "real_revenue"];

/** The shape any completeness check needs. A subset of main_6_buyer_crm, so both a full
    CrmRow and a bare query result satisfy it. */
export interface DealFacts {
  pipeline_stage?: string | null;
  closing_price?: number | null;
  closing_date?: string | null;
  transfer_date?: string | null;
  commission?: number | null;
}

/** Pipeline stages that mean the deal is done. `Close` is in the list for completeness and
    is effectively unused — 8 leads sit in it carrying no money, no dates and no commission,
    because the team jumps straight to `Win`. Which is exactly why nothing below decides
    anything from the stage alone. */
export const CLOSED_DEAL_STAGES = new Set(["Win", "Close"]);

/**
 * Is this a closed deal?
 *
 * DELIBERATELY NOT "pipeline_stage === 'Win'". The stage is the least reliable signal on
 * the row: 4 completed deals — both dates filled, commission paid — still sit at `Lead`,
 * `Show` and `Appoint` because nobody went back to update the dropdown. Any of five
 * independent facts is enough, so a deal counts the moment ANY part of it is recorded and
 * a stale dropdown cannot hide it.
 *
 * ⚠️ THE LISTING'S STATUS IS NOT ONE OF THEM, though the first version of this function
 * used it. A listing marked `Sold Completed` means SOMEONE bought the unit — not that this
 * lead did. 188 leads point at the 52 listings that have sold, because a dozen people
 * viewing the same condo is what a viewing list looks like. Trusting that signal turned
 * 20 real deals into 205 and would have put a daily "you have 47 unfinished deals" notice
 * in front of every agent on the team, about deals they never made.
 *
 * The three deals that most need catching — L26-189, L26-322, L26-337, all with money and
 * no closing date — are caught by `commission` anyway. The listing signal added nothing but
 * noise.
 */
export function isClosed(d: DealFacts): boolean {
  return (
    CLOSED_DEAL_STAGES.has(d.pipeline_stage ?? "") ||
    d.commission != null ||
    d.closing_price != null ||
    d.closing_date != null ||
    d.transfer_date != null
  );
}

/**
 * What is missing from a closed deal.
 *
 * Returns [] for anything that is not closed — an open lead is not missing a closing price,
 * it just has not closed yet, and reporting it as a gap would put every live lead in the
 * company on the reminder list.
 *
 * `transfer_date` is never a gap. See the header: signed-not-yet-transferred is the normal
 * state of a healthy deal, and nagging about it would train people to ignore the bell.
 */
export function dealGaps(d: DealFacts): DealGap[] {
  if (!isClosed(d)) return [];
  const gaps: DealGap[] = [];
  if (d.closing_date == null) gaps.push("closing_date");
  if (d.closing_price == null) gaps.push("closing_price");
  if (d.commission == null) gaps.push("commission");
  return gaps;
}

/** A closed deal with nothing missing. */
export function isDealComplete(d: DealFacts): boolean {
  return isClosed(d) && dealGaps(d).length === 0;
}

/** Signed but not yet at the land office — in progress, not incomplete. */
export function isAwaitingTransfer(d: DealFacts): boolean {
  return isClosed(d) && d.closing_date != null && d.transfer_date == null;
}

/**
 * The two revenue answers. Ben, 2026-09-10: the dashboard toggles between them, default
 * `close`, "so that the sales or anyone can see both forecast and actual revenue".
 *
 *   close  — counted on `closing_date`. The sales scoreboard: what the team sold, and
 *            the FORECAST — work finished, money not yet in.
 *   win    — counted on `transfer_date`. The money: what actually completed.
 *
 * Today that is ฿3,008,700 across 12 deals against ฿1,791,000 across 7 — the ฿1.2M
 * between contract and land office is the whole point of showing both.
 *
 * They differ by design and must never be reconciled into one number. A deal signed in
 * April and transferred in July belongs to April on one and July on the other, and both
 * are correct.
 */
export type RevenueBasis = "close" | "win";

/* ── WHOSE MONEY `commission` IS (Ben, 2026-09-10) ───────────────────────────────
   The FULL commission the company receives from the owner — gross, before VAT, before
   the agent's share, before the 3% withholding. Never the salesperson's take-home.

   The accounting workbook "Revenue & Accounting Haus-Living" carries the payout chain on
   its Commission Sale tab: commission → strip VAT → the agent's rate (60% for most, 50%
   for some) → less 3% → less ฿750 → Final. Ben's call is that NONE of that belongs in the
   CRM: agents work out their own take-home, and the app speaks one number so that two
   screens cannot quote different "revenue" for the same deal.

   Every surface that shows this figure must therefore say whose it is — a salesperson
   reading ฿120,000 as their own is the failure mode. See the footer of
   components/dashboard/TargetRevenueCard.tsx. */

/* Named for the pipeline stages the team already says out loud, not for "signed" and
   "transferred" — lib/pipeline.ts keeps the buyer pipeline in English because that is
   what the company calls it, and a dashboard toggle that invents a second vocabulary for
   the same two events is a toggle people have to translate before they can use it. */
export const REVENUE_BASIS_LABEL: Record<RevenueBasis, string> = {
  close: "Close",
  win: "Win",
};

/** What each basis means, for the card's own footer. */
export const REVENUE_BASIS_HINT: Record<RevenueBasis, string> = {
  close: "นับจากวันเซ็นสัญญา — ยอดที่ทำได้แล้ว แต่ยังไม่ได้รับเงิน (คาดการณ์)",
  win: "นับจากวันโอน — เงินที่เข้าจริงแล้ว",
};

/** Guards a value off the URL, where anyone can type anything. */
export function asRevenueBasis(v: string | string[] | undefined): RevenueBasis {
  const one = Array.isArray(v) ? v[0] : v;
  return one === "win" ? "win" : "close";
}

/** The date a deal counts on, for a given basis. null = it does not count yet. */
export function revenueDate(d: DealFacts, basis: RevenueBasis): string | null {
  return (basis === "close" ? d.closing_date : d.transfer_date) ?? null;
}

/**
 * The listing status a closed deal implies.
 *
 * Writing this is safe in the direction that reading it was not: THIS deal closing does
 * mean the unit is sold, even though the unit being sold does not mean this deal closed.
 * Four listings today still say `Posted` under a deal with money and both dates, because
 * the two halves were maintained by hand. Closing a deal now sets it.
 */
export const SOLD_LISTING_STATUS = "Sold Completed";

/** The stage a closed deal implies. Set on close so the dropdown stops drifting. */
export const CLOSED_PIPELINE_STAGE = "Win";


/* ══════════════════════════════════════════════════════════════════════════════
   THE CASE — a closed deal as its own record (2026-09-10)
   ══════════════════════════════════════════════════════════════════════════════
   Everything above this line was written when a deal was five columns on the lead. It
   is kept because the leads grid and the notifications still reason about a lead's
   closing facts — but those facts now come FROM a case, through `withCase()` below,
   rather than from the lead's own columns, which are no longer written.

   Why the case exists is on the table itself (closed_case). The short version: the
   company's register carries a STATUS, two revenue figures, co-broke splits and one lead
   with two deals, and five columns on a lead can hold none of that. */

export type CaseStatus = "pending" | "success" | "fail";
export type DealKind = "sale" | "rent";

export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  pending: "เซ็นแล้ว รอโอน",
  success: "โอนแล้ว",
  fail: "ดีลไม่จบ",
};

export const DEAL_KIND_LABEL: Record<DealKind, string> = { sale: "ขาย", rent: "เช่า" };

/** Default forecast commission on a SALE. Every one of the register's 47 sale cases works
    out to exactly 3% of the closing price, so the form offers it rather than asking for
    a number the person is about to compute by hand. Rent has no fixed rule and is asked. */
export const SALE_COMMISSION_RATE = 0.03;

export interface CaseAgent {
  employee_code: string;
  is_primary: boolean;
  forecast_share: number | null;
  real_share: number | null;
}

export interface ClosedCase {
  case_id: string;
  lead_id: string | null;
  listing_id: string | null;
  deal_type: DealKind;
  status: CaseStatus;
  closing_date: string | null;
  transfer_date: string | null;
  closing_price: number | null;
  /** FULL company commission — see the header of this file. */
  forecast_revenue: number | null;
  real_revenue: number | null;
  remark: string | null;
  buyer_name: string | null;
  agents: CaseAgent[];
}

/** PostgREST returns numeric columns as strings; the model wants numbers. */
export function toClosedCase(raw: Record<string, unknown>): ClosedCase {
  const num = (v: unknown) => (v == null || v === "" ? null : Number(v));
  const agents = Array.isArray(raw.agents) ? (raw.agents as Record<string, unknown>[]) : [];
  return {
    case_id: String(raw.case_id),
    lead_id: (raw.lead_id as string | null) ?? null,
    listing_id: (raw.listing_id as string | null) ?? null,
    deal_type: raw.deal_type === "rent" ? "rent" : "sale",
    status: raw.status === "success" ? "success" : raw.status === "fail" ? "fail" : "pending",
    closing_date: (raw.closing_date as string | null) ?? null,
    transfer_date: (raw.transfer_date as string | null) ?? null,
    closing_price: num(raw.closing_price),
    forecast_revenue: num(raw.forecast_revenue),
    real_revenue: num(raw.real_revenue),
    remark: (raw.remark as string | null) ?? null,
    buyer_name: (raw.buyer_name as string | null) ?? null,
    agents: agents.map((a) => ({
      employee_code: String(a.employee_code),
      is_primary: !!a.is_primary,
      forecast_share: num(a.forecast_share),
      real_share: num(a.real_share),
    })),
  };
}

/**
 * The case a lead's screens show. The live one, and failing that the latest — a lead
 * whose only deal fell through should say so, not look untouched. L26-655 is the case
 * that made this a function: one failed case, then a successful one on the same lead.
 */
export function primaryCase(cases: ClosedCase[] | null | undefined): ClosedCase | null {
  if (!cases?.length) return null;
  const sorted = [...cases].sort(
    (a, b) =>
      (b.closing_date ?? "").localeCompare(a.closing_date ?? "") || b.case_id.localeCompare(a.case_id)
  );
  return sorted.find((c) => c.status !== "fail") ?? sorted[0];
}

/**
 * What a case is still missing, by what its status claims.
 *   pending  the signing facts — date, price, forecast commission.
 *   success  those, plus the transfer date and the real figure: "the money arrived"
 *            with no when or how much is a claim, not a record.
 *   fail     nothing. It is over, and nagging about a dead deal's price is noise.
 */
export function caseGaps(c: ClosedCase): DealGap[] {
  if (c.status === "fail") return [];
  const gaps: DealGap[] = [];
  if (c.closing_date == null) gaps.push("closing_date");
  if (c.closing_price == null) gaps.push("closing_price");
  if (c.forecast_revenue == null) gaps.push("commission");
  if (c.status === "success") {
    if (c.transfer_date == null) gaps.push("transfer_date");
    if (c.real_revenue == null) gaps.push("real_revenue");
  }
  return gaps;
}

/**
 * A lead row with its closing facts filled in FROM its case.
 *
 * This is how the leads grid, `isClosed()` and every older reader keep working
 * unchanged: they still see `commission`, `closing_date` and the rest on the row — but
 * the values come from closed_case, not from the lead's own columns. One source, one
 * code path, no consumer had to learn a new shape.
 *
 * `commission` is the REAL figure once the case is success and one is recorded, else the
 * forecast; a failed case carries no commission at all, whatever was forecast.
 */
export function withCase<T extends { closed_case?: unknown }>(
  row: T
): T & DealFacts & { case_closing_remark: string | null; primary_case: ClosedCase | null } {
  const raw = Array.isArray(row.closed_case) ? (row.closed_case as Record<string, unknown>[]) : [];
  const c = primaryCase(raw.map(toClosedCase));
  return {
    ...row,
    primary_case: c,
    closing_price: c?.closing_price ?? null,
    closing_date: c?.closing_date ?? null,
    transfer_date: c?.transfer_date ?? null,
    commission:
      c == null || c.status === "fail"
        ? null
        : c.status === "success" && c.real_revenue != null
          ? c.real_revenue
          : c.forecast_revenue,
    case_closing_remark: c?.remark ?? null,
  };
}
