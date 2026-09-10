"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import { CLOSED_PIPELINE_STAGE, SOLD_LISTING_STATUS, isClosed } from "@/lib/deals";
import { syncLeadLastMatch } from "@/lib/lastMatchSync";

// บันทึกการปิดการขาย — the one write that records a sale.
//
// Before this existed there was none. `commission`, `closing_date` and `transfer_date` were
// rendered on two screens and written by no screen at all, so a closed deal reached the
// database only by way of the spreadsheet import. "Inform admin the old way" was not a
// process anyone chose; it was the only path that existed.
//
// ── WHAT THIS ASKS FOR vs WHAT IT WORKS OUT ─────────────────────────────────────
// Asks (only the sale knows):  closing_price, closing_date, transfer_date, commission
// Works out (already stored):  sale_id ← the listing, pipeline_stage, listing_status
//
// ── THE LISTING WRITE IS BEST-EFFORT, ON PURPOSE ────────────────────────────────
// Marking the listing sold needs `listings.edit`, which plenty of agents do not hold. If
// that write is refused the deal is still saved and the caller is told the listing was left
// alone. The alternative — failing the whole close because a second table refused — would
// lose the number we most need and send the agent back to messaging admin, which is the
// exact behaviour this file exists to replace.

type Result =
  | { ok: true; listingUpdated: boolean }
  | { ok: false; error: string };

type Row = Record<string, unknown>;

/** What the close form collects. Strings, because they come from inputs; "" means cleared. */
export interface DealCloseInput {
  /** ราคาปิดจริง — may differ from the listing's asking price, which is why it is asked. */
  closingPrice: string;
  /** วันที่ปิด (เซ็นสัญญา) — ISO yyyy-mm-dd. */
  closingDate: string;
  /** วันที่โอน — ISO yyyy-mm-dd. Blank is normal: transfer follows signing by weeks. */
  transferDate: string;
  commission: string;
  /** หมายเหตุ — main_6_buyer_crm.case_closing_remark. */
  remark: string;
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
 * Record (or correct) a deal's closing details.
 *
 * Gated on `leads.edit` — the same permission that edits any other field on the lead. A
 * separate "close" permission was considered and rejected: closing is not a privileged act,
 * it is the ordinary end of the job the lead's owner was already doing, and a gate they do
 * not hold is a gate they route around by messaging admin.
 */
export async function saveDealClose(leadId: string, input: DealCloseInput): Promise<Result> {
  const auth = await getAuthContext();
  if (!auth?.employeeCode) return { ok: false, error: "ไม่พบสิทธิ์ผู้ใช้ กรุณาเข้าสู่ระบบใหม่" };
  const perms = new Set(auth.permissions);
  if (!(perms.has("leads.edit") || perms.has("leads.assign") || perms.has("roles.manage"))) {
    return { ok: false, error: "ไม่มีสิทธิ์บันทึกการปิดการขาย" };
  }

  const closingPrice = money(input.closingPrice);
  const commission = money(input.commission);
  if (input.closingPrice.trim() !== "" && (closingPrice == null || closingPrice <= 0)) {
    return { ok: false, error: "ราคาปิดต้องเป็นตัวเลขมากกว่า 0" };
  }
  if (input.commission.trim() !== "" && (commission == null || commission < 0)) {
    return { ok: false, error: "คอมมิชชั่นต้องเป็นตัวเลข" };
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

  const supabase = await createClient();
  const { data: current, error: fetchError } = await supabase
    .from("main_6_buyer_crm")
    .select("sale_id,listing_code,pipeline_stage,closing_price,closing_date,transfer_date,commission,case_closing_remark")
    .eq("lead_id", leadId)
    .maybeSingle();
  if (fetchError || !current) return { ok: false, error: fetchError?.message ?? "ไม่พบ Lead นี้" };

  const patch: Row = {
    closing_price: closingPrice,
    closing_date: closing.value,
    transfer_date: transfer.value,
    commission,
    case_closing_remark: input.remark.trim() || null,
  };

  // ── DERIVED, not asked ────────────────────────────────────────────────────────
  const listingCode = (current.listing_code as string | null) || null;
  interface ListingCtx {
    listing_id: string;
    sale_id: string | null;
    listing_status: string | null;
  }
  let listing: ListingCtx | null = null;
  if (listingCode) {
    const { data } = await supabase
      .from("main_4_listing_database")
      .select("listing_id,sale_id,listing_status")
      .eq("listing_id", listingCode)
      .maybeSingle();
    listing = (data as unknown as ListingCtx | null) ?? null;
  }

  // The listing already knows who sells it. L26-007 is the case in point: no sale on the
  // lead, C-001 on the listing. Only fills a BLANK — never overwrites a real assignment,
  // because a lead can legitimately be worked by someone other than the listing's owner.
  if (!current.sale_id && listing?.sale_id) patch.sale_id = listing.sale_id;

  // Any money or date at all means the deal happened, so the dropdown should say so. Four
  // completed deals sit at Lead/Show/Appoint today purely because nobody went back to it.
  const nowClosed = isClosed({
    pipeline_stage: current.pipeline_stage as string | null,
    closing_price: closingPrice,
    closing_date: closing.value,
    transfer_date: transfer.value,
    commission,
  });
  if (nowClosed && current.pipeline_stage !== CLOSED_PIPELINE_STAGE) {
    patch.pipeline_stage = CLOSED_PIPELINE_STAGE;
  }

  const before: Row = {};
  const changed: Row = {};
  for (const [k, v] of Object.entries(patch)) {
    const was = (current as Row)[k] ?? null;
    // Numerics come back from Postgres as strings; compare loosely so re-saving an
    // unchanged form does not write a no-op row and an audit entry nobody caused.
    if (String(was ?? "") === String(v ?? "")) continue;
    before[k] = was;
    changed[k] = v;
  }

  if (Object.keys(changed).length > 0) {
    const { error: updateError } = await supabase
      .from("main_6_buyer_crm")
      .update(changed)
      .eq("lead_id", leadId);
    if (updateError) return { ok: false, error: updateError.message };

    await supabase.from("audit_log").insert({
      entity: "main_6_buyer_crm",
      entity_id: leadId,
      action: "close_deal",
      changed_by: auth.employeeCode,
      before,
      after: changed,
    });
  }

  /* Record the sale in the market log, or update the entry already there.
     Best-effort, for the same reason the listing write is: writing it needs `lastmatch.add`,
     and a sale who does not hold it must not lose the deal they just saved over a second
     table. One row per lead is guaranteed by the database (uq_last_match_lead), so saving
     this form again — which everyone does, weeks later, to add the transfer date — updates
     the entry instead of adding another. */
  if (nowClosed) {
    await syncLeadLastMatch(supabase, auth.employeeCode, {
      leadId,
      price: closingPrice,
      remark: input.remark,
    });
  }

  // Best-effort — see the header. A refusal here is an ordinary outcome, not an error.
  let listingUpdated = false;
  if (nowClosed && listing && listing.listing_status !== SOLD_LISTING_STATUS) {
    const { error } = await supabase
      .from("main_4_listing_database")
      .update({ listing_status: SOLD_LISTING_STATUS })
      .eq("listing_id", listing.listing_id);
    if (!error) {
      listingUpdated = true;
      await supabase.from("audit_log").insert({
        entity: "main_4_listing_database",
        entity_id: listing.listing_id,
        action: "sold_by_deal",
        changed_by: auth.employeeCode,
        before: { listing_status: listing.listing_status },
        after: { listing_status: SOLD_LISTING_STATUS },
      });
    }
  }

  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/last-match");
  if (listingUpdated && listing) revalidatePath(`/listings/${listing.listing_id}`);
  return { ok: true, listingUpdated };
}
