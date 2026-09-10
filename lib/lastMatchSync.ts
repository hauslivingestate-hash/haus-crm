import type { createClient } from "@/lib/supabase/server";

/* Keeping main_7_last_match in step with a lead's close.
 *
 * ── WHY THIS IS NOT IN EITHER MUTATION FILE ─────────────────────────────────────
 * Two callers need it: the closing card (lib/mutations/deals.ts) and closeDeal()
 * (lib/mutations/lastMatch.ts). Both are "use server" modules, whose exports are call
 * boundaries — a Supabase client cannot be handed across one. So the shared logic sits
 * here, in a plain module, and each action passes in the client and caller it already has.
 * That also keeps it to zero extra round trips: no second auth lookup, no second client.
 *
 * ── WHAT THE TABLE IS ───────────────────────────────────────────────────────────
 * A log of how a property left the market, not a list of our sales. Of the 56 rows imported
 * from the sheet, 20 were sold by the owner, 14 taken by another agency, 4 were new from the
 * developer — and 16 were ours (ปิดเอง). Our closes belong in it; the company's REVENUE does
 * not come out of it. Revenue is main_6_buyer_crm.closing_price. Summing this table would
 * add up the market's money with ours.
 *
 * ── ONE ROW PER LEAD, ENFORCED BY THE DATABASE ──────────────────────────────────
 * uq_last_match_lead (unique on lead_id where not null). The closing card is saved more than
 * once by design — you come back weeks later to add the transfer date — so an insert-only
 * version would have written one row per save. This updates in place instead, and treats a
 * unique violation from two simultaneous saves as "already recorded" rather than a failure.
 */

type Supa = Awaited<ReturnType<typeof createClient>>;

export type SyncResult =
  | { ok: true; lastMatchId: string | null }
  | { ok: false; error: string };

/**
 * Mint the next `last_match_id`.
 *
 * ⚠️ There is NO trigger on this table, and the ids already in it are nickname-based
 * (`Stone-10`, `Stone+Pup-01`) from the sheet import — not the `S-001-001` shape CLAUDE.md
 * describes. Following what the data actually does rather than what the note says, so the
 * ledger stays readable to the people who have been keeping it.
 */
export async function nextMatchId(supabase: Supa, saleId: string): Promise<string> {
  const { data: emp } = await supabase
    .from("main_1_hr")
    .select("nickname")
    .eq("employee_code", saleId)
    .maybeSingle();
  const prefix = (emp?.nickname as string | undefined) || saleId;

  const { data: existing } = await supabase
    .from("main_7_last_match")
    .select("last_match_id")
    .like("last_match_id", `${prefix}-%`);
  const highest = ((existing ?? []) as { last_match_id: string }[]).reduce((max, r) => {
    const n = Number(r.last_match_id.slice(prefix.length + 1));
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return `${prefix}-${String(highest + 1).padStart(2, "0")}`;
}

/**
 * Record this lead's close in the market log, or bring the existing entry up to date.
 *
 * Everything except the price is copied from the lead and the listing the deal is priced
 * against, so nobody retypes a property that is already in the database.
 *
 * Returns ok with a null id when there is nothing to record (no price yet) — that is a
 * normal outcome, not a failure. The caller treats a refusal the same way it treats the
 * listing write: best-effort, because losing a saved deal over a second table is worse than
 * a missing market entry.
 */
export async function syncLeadLastMatch(
  supabase: Supa,
  employeeCode: string,
  input: { leadId: string; price: number | null; remark: string | null; closeType?: string | null }
): Promise<SyncResult> {
  const price = input.price;
  if (price == null || !Number.isFinite(price) || price <= 0) {
    // No number yet — a close with dates but no price is normal mid-flow. Nothing to log.
    return { ok: true, lastMatchId: null };
  }

  const { data: existing } = await supabase
    .from("main_7_last_match")
    .select("last_match_id,last_match_price,last_match_remark")
    .eq("lead_id", input.leadId)
    .maybeSingle();

  const remark = input.remark?.trim() || null;

  if (existing) {
    const row = existing as { last_match_id: string; last_match_price: number | null; last_match_remark: string | null };
    // Numerics arrive as strings from Postgres; compare loosely so re-saving an unchanged
    // form writes neither a row nor an audit entry nobody caused.
    const same =
      String(row.last_match_price ?? "") === String(price) &&
      (row.last_match_remark ?? "") === (remark ?? "");
    if (same) return { ok: true, lastMatchId: row.last_match_id };

    const { error } = await supabase
      .from("main_7_last_match")
      .update({ last_match_price: price, last_match_remark: remark })
      .eq("last_match_id", row.last_match_id);
    if (error) return { ok: false, error: error.message };

    await supabase.from("audit_log").insert({
      entity: "main_7_last_match",
      entity_id: row.last_match_id,
      action: "set_price",
      changed_by: employeeCode,
      before: { last_match_price: row.last_match_price, last_match_remark: row.last_match_remark },
      after: { last_match_price: price, last_match_remark: remark },
    });
    return { ok: true, lastMatchId: row.last_match_id };
  }

  const { data: lead } = await supabase
    .from("main_6_buyer_crm")
    .select("lead_id,sale_id,listing_code,lead_name")
    .eq("lead_id", input.leadId)
    .maybeSingle();
  if (!lead) return { ok: false, error: "ไม่พบลีดนี้" };

  // The deal belongs to whoever owns the lead; fall back to the person doing the closing
  // when the lead is unassigned, because the id generator needs a sale_id.
  const saleId = (lead.sale_id as string | null) ?? employeeCode;

  // Copy the property details across from the unit the deal is priced against.
  let listing: Record<string, unknown> | null = null;
  if (lead.listing_code) {
    const { data } = await supabase
      .from("v_main_listing")
      .select("listing_name,property_type,zone,area_wa,area_sqm,bed,bath")
      .eq("listing_id", lead.listing_code)
      .maybeSingle();
    listing = data ?? null;
  }

  const lastMatchId = await nextMatchId(supabase, saleId);
  const { data, error } = await supabase
    .from("main_7_last_match")
    .insert({
      last_match_id: lastMatchId,
      lead_id: input.leadId,
      sale_id: saleId,
      // Ours, by definition: this row exists because we closed the deal.
      close_type: input.closeType || "ปิดเอง",
      project_name: (listing?.listing_name as string | null) ?? null,
      property_type: (listing?.property_type as string | null) ?? null,
      zone: (listing?.zone as string | null) ?? null,
      sq_wa: (listing?.area_wa as number | null) ?? null,
      sq_m: (listing?.area_sqm as number | null) ?? null,
      bed: (listing?.bed as number | null) ?? null,
      bath: (listing?.bath as number | null) ?? null,
      last_match_price: price,
      last_match_remark: remark,
      buyer_persona: (lead.lead_name as string | null) ?? null,
      date_created: new Date().toISOString().slice(0, 10),
    })
    .select("last_match_id")
    .single();

  if (error) {
    // 23505 = uq_last_match_lead. Two saves raced; the other one won and the deal is
    // recorded, which is the outcome we wanted. Not worth failing a close over.
    if (error.code === "23505") return { ok: true, lastMatchId: null };
    return { ok: false, error: error.message };
  }

  await supabase.from("audit_log").insert({
    entity: "main_7_last_match",
    entity_id: data.last_match_id as string,
    action: "close_deal",
    changed_by: employeeCode,
    before: { lead_id: input.leadId },
    after: { last_match_price: price, close_type: input.closeType || "ปิดเอง" },
  });

  return { ok: true, lastMatchId: data.last_match_id as string };
}
