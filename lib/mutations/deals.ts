"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import {
  CLOSED_PIPELINE_STAGE,
  SOLD_LISTING_STATUS,
  SALE_COMMISSION_RATE,
  type CaseStatus,
  type DealKind,
} from "@/lib/deals";
import { syncLeadLastMatch } from "@/lib/lastMatchSync";

// บันทึกการปิดการขาย — the one write that records a sale. Since 2026-09-10 it writes a
// CASE (closed_case + closed_case_agent), not five columns on the lead.
//
// ── WHAT THIS ASKS FOR vs WHAT IT WORKS OUT ─────────────────────────────────────
// Asks (only the sale knows):  deal type, closing price, signing date, forecast
//                              commission (offered at 3% on a sale), a co-agent and the
//                              split if there is one — and later the transfer date and
//                              the real figure.
// Works out (already stored):  the case id, who is credited (the lead's sale, else the
//                              listing's), the listing, STATUS — pending on signing,
//                              success the moment a transfer date is entered — the lead's
//                              stage, the listing's status, the Last Match record.
//
// ── STATUS IS DERIVED, NOT ASKED ────────────────────────────────────────────────
// A person entering a transfer date is saying the money arrived; asking them to also
// flip a dropdown to "success" is asking the same question twice, and the second answer
// drifts. The only status a person sets by hand is `fail`, because nothing in the data
// can know a deal fell through — and it is its own button with its own confirmation.
//
// ── THE LEAD'S FIVE OLD COLUMNS ARE NOT TOUCHED ─────────────────────────────────
// commission / closing_price / closing_date / transfer_date / case_closing_remark stay
// with whatever they held. Nothing reads them; lib/queries.ts fills the same fields on a
// CrmRow from the case. Dropping them is a separate decision.
//
// ── THE LISTING WRITE IS BEST-EFFORT, ON PURPOSE ────────────────────────────────
// Marking the listing sold needs `listings.edit`, which plenty of agents do not hold. If
// that write is refused the case is still saved and the caller is told the listing was
// left alone. Failing the whole close because a second table refused would lose the
// number we most need.

type Result =
  | { ok: true; caseId: string; status: CaseStatus; listingUpdated: boolean }
  | { ok: false; error: string };

type Row = Record<string, unknown>;

/** What the close form collects. Strings, because they come from inputs; "" means blank. */
export interface DealCloseInput {
  /** The case being edited, or null to open a new one on this lead. */
  caseId: string | null;
  dealType: DealKind;
  /** ราคาปิดจริง — may differ from the listing's asking price, which is why it is asked. */
  closingPrice: string;
  /** วันเซ็นสัญญา — ISO yyyy-mm-dd. */
  closingDate: string;
  /** Full company commission expected. Blank on a sale = 3% of the price. */
  forecastRevenue: string;
  /** วันโอน — ISO. Blank is normal: transfer follows signing by weeks. Filling it in is
      what turns the case to `success`. */
  transferDate: string;
  /** What actually arrived. Blank = the forecast stands until someone corrects it. */
  realRevenue: string;
  remark: string;
  /** A second agent credited on this deal, with their share of each figure in baht. Blank
      shares = an even split. */
  coAgent: { employeeCode: string; forecastShare: string; realShare: string } | null;
  /** The one status a person sets by hand. */
  markFailed?: boolean;
}

/** A money string from an input: strips the thousands separators people paste in. */
function money(raw: string): number | null {
  const t = raw.replace(/,/g, "").trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** A date input, validated. Rejects the blank-read-as-zero dates that put six rows of
    main_7_last_match in 1899 — a date before the company existed is a failed parse, not a
    date, and storing it once means every later reader has to know about it. */
function day(raw: string): { ok: true; value: string | null } | { ok: false } {
  const t = raw.trim();
  if (t === "") return { ok: true, value: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return { ok: false };
  const d = new Date(`${t}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return { ok: false };
  const year = d.getUTCFullYear();
  if (year < 2000 || year > 2100) return { ok: false };
  return { ok: true, value: t };
}

/**
 * Record (or correct) a deal.
 *
 * Gated on `leads.edit` — the same permission that edits any other field on the lead.
 * Closing is not a privileged act; it is the ordinary end of the job the lead's owner was
 * already doing, and a gate they do not hold is a gate they route around by messaging
 * admin. RLS on closed_case says the same thing independently.
 */
export async function saveDealClose(leadId: string, input: DealCloseInput): Promise<Result> {
  const auth = await getAuthContext();
  if (!auth?.employeeCode) return { ok: false, error: "ไม่พบสิทธิ์ผู้ใช้ กรุณาเข้าสู่ระบบใหม่" };
  const perms = new Set(auth.permissions);
  if (!(perms.has("leads.edit") || perms.has("leads.assign") || perms.has("roles.manage"))) {
    return { ok: false, error: "ไม่มีสิทธิ์บันทึกการปิดการขาย" };
  }

  // ── Validate what was typed ─────────────────────────────────────────────────
  const closingPrice = money(input.closingPrice);
  if (input.closingPrice.trim() !== "" && (closingPrice == null || closingPrice <= 0)) {
    return { ok: false, error: "ราคาปิดต้องเป็นตัวเลขมากกว่า 0" };
  }
  let forecast = money(input.forecastRevenue);
  if (input.forecastRevenue.trim() !== "" && (forecast == null || forecast < 0)) {
    return { ok: false, error: "คอมมิชชั่นต้องเป็นตัวเลข" };
  }
  // The rule the whole register follows: every sale case is exactly 3% of the price.
  // Offered, not imposed — a typed figure always wins.
  if (forecast == null && input.dealType === "sale" && closingPrice != null) {
    forecast = Math.round(closingPrice * SALE_COMMISSION_RATE);
  }
  const real = money(input.realRevenue);
  if (input.realRevenue.trim() !== "" && (real == null || real < 0)) {
    return { ok: false, error: "ยอดที่ได้รับจริงต้องเป็นตัวเลข" };
  }

  const closing = day(input.closingDate);
  const transfer = day(input.transferDate);
  if (!closing.ok) return { ok: false, error: "วันที่ปิดไม่ถูกต้อง" };
  if (!transfer.ok) return { ok: false, error: "วันที่โอนไม่ถูกต้อง" };
  // Transfer is the land office; it cannot precede the contract. Caught here because the
  // pair is only wrong together — neither date is invalid on its own.
  if (closing.value && transfer.value && transfer.value < closing.value) {
    return { ok: false, error: "วันที่โอนต้องไม่ก่อนวันที่ปิด" };
  }

  // ── Status: derived, except `fail` ──────────────────────────────────────────
  const status: CaseStatus = input.markFailed ? "fail" : transfer.value ? "success" : "pending";

  const supabase = await createClient();
  const { data: lead, error: leadError } = await supabase
    .from("main_6_buyer_crm")
    .select("lead_id,lead_name,sale_id,listing_code,pipeline_stage,marketing_channel")
    .eq("lead_id", leadId)
    .maybeSingle();
  if (leadError || !lead) return { ok: false, error: leadError?.message ?? "ไม่พบ Lead นี้" };

  // ── DERIVED, not asked ──────────────────────────────────────────────────────
  const listingCode = (lead.listing_code as string | null) || null;
  interface ListingCtx { listing_id: string; sale_id: string | null; listing_status: string | null }
  let listing: ListingCtx | null = null;
  if (listingCode) {
    const { data } = await supabase
      .from("main_4_listing_database")
      .select("listing_id,sale_id,listing_status")
      .eq("listing_id", listingCode)
      .maybeSingle();
    listing = (data as unknown as ListingCtx | null) ?? null;
  }

  // Who is credited. The lead's sale, else the listing's (L26-007: no sale on the lead,
  // C-001 on the listing), else whoever is saving — a deal with nobody on it is a deal
  // nobody's dashboard can see.
  const primaryCode = (lead.sale_id as string | null) || listing?.sale_id || auth.employeeCode;

  // The split. Shares are baht, never percentages — the register's own splits are not
  // always even. Blank shares on a co-agent mean half each.
  let coCode: string | null = null;
  let coForecast: number | null = null;
  let coReal: number | null = null;
  if (input.coAgent?.employeeCode) {
    coCode = input.coAgent.employeeCode;
    if (coCode === primaryCode) return { ok: false, error: "โคเอเจนต์ต้องไม่ใช่คนเดียวกับเจ้าของดีล" };
    coForecast = money(input.coAgent.forecastShare);
    coReal = money(input.coAgent.realShare);
    if (coForecast == null && forecast != null) coForecast = Math.round(forecast / 2);
    if (coReal == null && real != null) coReal = Math.round(real / 2);
    if (forecast != null && coForecast != null && coForecast > forecast) {
      return { ok: false, error: "ส่วนแบ่งของโคเอเจนต์มากกว่าคอมมิชชั่นทั้งหมด" };
    }
  }
  const primaryForecast = forecast == null ? null : forecast - (coForecast ?? 0);
  const primaryReal = real == null ? null : real - (coReal ?? 0);

  // ── The case id ─────────────────────────────────────────────────────────────
  let caseId = input.caseId?.trim() || null;
  let existing: Row | null = null;
  if (caseId) {
    const { data } = await supabase
      .from("closed_case")
      .select("*")
      .eq("case_id", caseId)
      .eq("lead_id", leadId) // a case id off another lead is a bug, not a request
      .maybeSingle();
    if (!data) return { ok: false, error: "ไม่พบเคสนี้ในลีดนี้" };
    existing = data as Row;
  } else {
    const { data, error } = await supabase.rpc("next_case_id");
    if (error || !data) return { ok: false, error: error?.message ?? "สร้างรหัสเคสไม่สำเร็จ" };
    caseId = String(data);
  }

  const patch: Row = {
    lead_id: leadId,
    listing_id: listing?.listing_id ?? null,
    listing_ref: listingCode,
    deal_type: input.dealType,
    status,
    closing_date: closing.value,
    transfer_date: transfer.value,
    closing_price: closingPrice,
    forecast_revenue: forecast,
    real_revenue: real,
    buyer_name: (lead.lead_name as string | null) ?? null,
    channel: (lead.marketing_channel as string | null) ?? null,
    remark: input.remark.trim() || null,
  };

  if (existing) {
    // Only what changed, so re-saving an unchanged form writes no row and no audit entry
    // nobody caused. Numerics come back as strings; compare loosely.
    const before: Row = {};
    const changed: Row = {};
    for (const [k, v] of Object.entries(patch)) {
      const was = existing[k] ?? null;
      if (String(was ?? "") === String(v ?? "")) continue;
      before[k] = was;
      changed[k] = v;
    }
    if (Object.keys(changed).length > 0) {
      const { error } = await supabase.from("closed_case").update(changed).eq("case_id", caseId);
      if (error) return { ok: false, error: error.message };
      await supabase.from("audit_log").insert({
        entity: "closed_case",
        entity_id: caseId,
        action: "close_deal",
        changed_by: auth.employeeCode,
        before,
        after: changed,
      });
    }
  } else {
    const { error } = await supabase
      .from("closed_case")
      .insert({ case_id: caseId, created_by: auth.employeeCode, ...patch });
    if (error) return { ok: false, error: error.message };
    await supabase.from("audit_log").insert({
      entity: "closed_case",
      entity_id: caseId,
      action: "close_deal",
      changed_by: auth.employeeCode,
      before: {},
      after: { case_id: caseId, ...patch },
    });
  }

  // ── The credit list ─────────────────────────────────────────────────────────
  // Whoever is no longer on the deal comes off it; the rest are written in full. A
  // removed co-agent is the only way a share disappears, and it disappears entirely
  // rather than lingering at zero.
  const keep = [primaryCode, ...(coCode ? [coCode] : [])];
  await supabase.from("closed_case_agent").delete().eq("case_id", caseId).not("employee_code", "in", `(${keep.join(",")})`);
  const { error: agentError } = await supabase.from("closed_case_agent").upsert(
    [
      { case_id: caseId, employee_code: primaryCode, is_primary: true, forecast_share: primaryForecast, real_share: primaryReal },
      ...(coCode
        ? [{ case_id: caseId, employee_code: coCode, is_primary: false, forecast_share: coForecast, real_share: coReal }]
        : []),
    ],
    { onConflict: "case_id,employee_code" }
  );
  if (agentError) return { ok: false, error: agentError.message };

  // ── What a live deal implies for the lead and the listing ───────────────────
  // A failed case implies nothing: the person decides what the lead becomes.
  let listingUpdated = false;
  if (status !== "fail") {
    const leadPatch: Row = {};
    if (lead.pipeline_stage !== CLOSED_PIPELINE_STAGE) leadPatch.pipeline_stage = CLOSED_PIPELINE_STAGE;
    if (!lead.sale_id && primaryCode) leadPatch.sale_id = primaryCode;
    if (Object.keys(leadPatch).length > 0) {
      await supabase.from("main_6_buyer_crm").update(leadPatch).eq("lead_id", leadId);
    }

    /* The market log. Best-effort for the same reason the listing write is: it needs
       `lastmatch.add`, and a sale who lacks it must not lose the deal they just saved
       over a second table. One row per lead (uq_last_match_lead), updated in place. */
    await syncLeadLastMatch(supabase, auth.employeeCode, {
      leadId,
      price: closingPrice,
      remark: input.remark,
    });

    if (listing && listing.listing_status !== SOLD_LISTING_STATUS) {
      const { error } = await supabase
        .from("main_4_listing_database")
        .update({ listing_status: SOLD_LISTING_STATUS })
        .eq("listing_id", listing.listing_id);
      listingUpdated = !error;
    }
  }

  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/");
  revalidatePath("/last-match");
  revalidatePath("/today");
  return { ok: true, caseId, status, listingUpdated };
}
