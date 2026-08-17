"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";

// ราคาปิดดีล — `main_7_last_match.last_match_price`.
//
// Ben, 2026-08-15: capture it when the lead moves to Win/Close, and let the 56 existing
// deals be back-filled on the Last Match page.
//
// ⚠️ WHY THIS EXISTS. The price column was empty on all 56 rows, which is the single reason
// the dashboard is parked: it was ported from HAUS V2 with revenue as its spine, so five of
// its six overview blocks render ฿0 without this. There is nowhere else in the database
// that a closing price is recorded — main_6_buyer_crm has `commission` and `closing_date`
// but no sale price — so this table is it.

type Result = { ok: true } | { ok: false; error: string };

// Writing is gated on `lastmatch.add`, NOT the view permissions — that is what the INSERT
// and UPDATE policies on main_7_last_match ask for. agent / sales_leader / listing_support /
// ceo / system_admin hold it.
async function requireEdit(): Promise<{ employeeCode: string; canAll: boolean } | { error: string }> {
  const auth = await getAuthContext();
  if (!auth?.employeeCode) return { error: "ไม่พบสิทธิ์ผู้ใช้ กรุณาเข้าสู่ระบบใหม่" };
  const perms = new Set(auth.permissions);
  if (!(perms.has("lastmatch.add") || perms.has("roles.manage"))) {
    return { error: "ไม่มีสิทธิ์บันทึกดีลที่ปิด" };
  }
  return {
    employeeCode: auth.employeeCode,
    canAll: perms.has("lastmatch.view_all") || perms.has("roles.manage"),
  };
}

/**
 * Mint the next `last_match_id`.
 *
 * ⚠️ There is NO trigger on this table, and the ids already in it are nickname-based
 * (`Stone-10`, `Stone+Pup-01`) from the sheet import — not the `S-001-001` shape CLAUDE.md
 * describes. Following what the data actually does rather than what the note says, so the
 * ledger stays readable to the people who have been keeping it.
 */
async function nextMatchId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  saleId: string
): Promise<string> {
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

/** Back-fill or correct a closed deal's price and note. */
export async function setMatchPrice(
  lastMatchId: string,
  price: number | null,
  remark: string | null
): Promise<Result> {
  const auth = await requireEdit();
  if ("error" in auth) return { ok: false, error: auth.error };
  if (price != null && (!Number.isFinite(price) || price < 0)) {
    return { ok: false, error: "ราคาต้องไม่ติดลบ" };
  }

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("main_7_last_match")
    .select("last_match_id,sale_id,last_match_price,last_match_remark")
    .eq("last_match_id", lastMatchId)
    .maybeSingle();
  if (!current) return { ok: false, error: "ไม่พบดีลนี้" };
  // RLS already scopes what is readable; this stops someone with own-scope editing a row
  // they can see only because they hold team/all read.
  if (!auth.canAll && current.sale_id && current.sale_id !== auth.employeeCode) {
    return { ok: false, error: "แก้ได้เฉพาะดีลของตัวเอง" };
  }

  const { error } = await supabase
    .from("main_7_last_match")
    .update({ last_match_price: price, last_match_remark: remark?.trim() || null })
    .eq("last_match_id", lastMatchId);
  if (error) return { ok: false, error: error.message };

  await supabase.from("audit_log").insert({
    entity: "main_7_last_match",
    entity_id: lastMatchId,
    action: "set_price",
    changed_by: auth.employeeCode,
    before: { last_match_price: current.last_match_price },
    after: { last_match_price: price },
  });

  revalidatePath("/last-match");
  revalidatePath("/");
  return { ok: true };
}

export interface CloseDealInput {
  leadId: string;
  price: number;
  closeType?: string | null;
  remark?: string | null;
}

/**
 * Record the deal behind a lead that just reached Win/Close.
 *
 * Called from the lead editor when the stage moves into a closed state — the moment the
 * number is actually known. Everything except the price is copied from the lead and the
 * listing it was interested in, so the rep types one figure rather than re-entering the
 * property.
 *
 * The id is minted here (see nextMatchId) because this table has no trigger.
 */
export async function closeDeal(input: CloseDealInput): Promise<
  { ok: true; lastMatchId: string } | { ok: false; error: string }
> {
  const auth = await requireEdit();
  if ("error" in auth) return { ok: false, error: auth.error };
  if (!Number.isFinite(input.price) || input.price <= 0) {
    return { ok: false, error: "ต้องกรอกราคาปิดที่มากกว่า 0" };
  }

  const supabase = await createClient();
  const { data: lead } = await supabase
    .from("main_6_buyer_crm")
    .select("lead_id,sale_id,listing_code,lead_name")
    .eq("lead_id", input.leadId)
    .maybeSingle();
  if (!lead) return { ok: false, error: "ไม่พบลีดนี้" };

  // The deal belongs to whoever owns the lead; fall back to the person doing the closing
  // when the lead is unassigned, because the id generator needs a sale_id.
  const saleId = (lead.sale_id as string | null) ?? auth.employeeCode;

  // Copy the property details across from the listing the lead was interested in.
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
      sale_id: saleId,
      close_type: input.closeType || "ปิดเอง",
      project_name: (listing?.listing_name as string | null) ?? null,
      property_type: (listing?.property_type as string | null) ?? null,
      zone: (listing?.zone as string | null) ?? null,
      sq_wa: (listing?.area_wa as number | null) ?? null,
      sq_m: (listing?.area_sqm as number | null) ?? null,
      bed: (listing?.bed as number | null) ?? null,
      bath: (listing?.bath as number | null) ?? null,
      last_match_price: input.price,
      last_match_remark: input.remark?.trim() || null,
      buyer_persona: (lead.lead_name as string | null) ?? null,
      date_created: new Date().toISOString().slice(0, 10),
    })
    .select("last_match_id")
    .single();
  if (error) return { ok: false, error: error.message };

  await supabase.from("audit_log").insert({
    entity: "main_7_last_match",
    entity_id: data.last_match_id as string,
    action: "close_deal",
    changed_by: auth.employeeCode,
    before: { lead_id: input.leadId },
    after: { price: input.price, sale_id: saleId },
  });

  revalidatePath("/last-match");
  revalidatePath("/leads");
  revalidatePath("/");
  return { ok: true, lastMatchId: data.last_match_id as string };
}
