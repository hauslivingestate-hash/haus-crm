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
  | "commission";

/** What each gap is called, and why it matters, for the reminder copy. */
export const DEAL_GAP_LABEL: Record<DealGap, string> = {
  closing_date: "วันที่ปิด",
  closing_price: "ราคาปิด",
  commission: "คอมมิชชั่น",
};

/** The order gaps are reported in — a deal missing several leads with the worst. */
export const DEAL_GAPS: DealGap[] = ["closing_date", "closing_price", "commission"];

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
