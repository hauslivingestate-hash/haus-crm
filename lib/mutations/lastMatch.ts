"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import { syncLeadLastMatch } from "@/lib/lastMatchSync";

// ราคาปิดดีล — `main_7_last_match.last_match_price`.
//
// Ben, 2026-08-15: capture it when the lead moves to Win/Close, and let the 56 existing
// deals be back-filled on the Last Match page.
//
// ⚠️ SUPERSEDED, 2026-09-06 — this is NOT where the company's revenue lives.
//
// The note below was written when `main_6_buyer_crm` had no sale price, so this table
// looked like the only home for one. Reading the rows settled it: only 16 of the 56 are
// this company's own deals. The rest are OTHER agencies' sales, recorded for comparison —
// this is a market log, and putting our revenue in it would mix our money with the market's.
//
// `main_6_buyer_crm.closing_price` is the sale price now, written by lib/mutations/deals.ts
// from the closing card on the lead. This file keeps doing what the table is actually for.
//
// (The original note, for context: the price column was empty on all 56 rows, which was the
// stated reason the dashboard is parked — it was ported from HAUS V2 with revenue as its
// spine, so five of its six overview blocks render ฿0 without a revenue source.)

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
 * Record the deal behind a lead in the market log.
 *
 * ⚠️ NOTHING CALLS THIS TODAY. It was the แก้ไข form's closing-price prompt, removed on
 * 2026-09-10 when stage editing moved to the จัดการ card — that prompt was a second way to
 * close a deal which wrote a different half of it from the closing card (this row, but never
 * the lead's own closing_price). The closing card is now the single path and calls the same
 * helper below.
 *
 * Kept rather than deleted because the entry point is still sound — a bulk importer or a
 * back-fill screen would want exactly this. It delegates so it can never again produce a
 * second, unlinked row for a lead the closing card has already recorded.
 */
export async function closeDeal(input: CloseDealInput): Promise<
  { ok: true; lastMatchId: string | null } | { ok: false; error: string }
> {
  const auth = await requireEdit();
  if ("error" in auth) return { ok: false, error: auth.error };
  if (!Number.isFinite(input.price) || input.price <= 0) {
    return { ok: false, error: "ต้องกรอกราคาปิดที่มากกว่า 0" };
  }

  const supabase = await createClient();
  const res = await syncLeadLastMatch(supabase, auth.employeeCode, {
    leadId: input.leadId,
    price: input.price,
    remark: input.remark ?? null,
    closeType: input.closeType ?? null,
  });
  if (!res.ok) return res;

  revalidatePath("/last-match");
  revalidatePath("/leads");
  revalidatePath("/");
  return { ok: true, lastMatchId: res.lastMatchId };
}

/**
 * Remove the market-log entry a lead's close created — the undo.
 *
 * Only ever reaches a row the closing card made (`lead_id` is set) and only that lead's, so
 * the 56 rows imported from the sheet are out of reach from here. The database enforces the
 * same thing independently: p_delete allows roles.manage anything, and everyone else only
 * their own linked rows (migration last_match_delete_own_auto_created).
 *
 * A market log that says a property sold when the sale fell through is worse than a missing
 * entry, which is why the person who caused it can clear it rather than having to ask.
 */
export async function removeLeadLastMatch(leadId: string): Promise<Result> {
  const auth = await requireEdit();
  if ("error" in auth) return { ok: false, error: auth.error };

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("main_7_last_match")
    .select("last_match_id,sale_id,last_match_price")
    .eq("lead_id", leadId)
    .maybeSingle();
  // Already gone, or never visible to this reader. Either way there is nothing to undo and
  // nothing to apologise for.
  if (!row) return { ok: true };

  const { error } = await supabase
    .from("main_7_last_match")
    .delete()
    .eq("lead_id", leadId);
  if (error) return { ok: false, error: error.message };

  // Written BEFORE the revalidate and after the delete: the row is gone, so this audit entry
  // is the only remaining record that it ever existed.
  await supabase.from("audit_log").insert({
    entity: "main_7_last_match",
    entity_id: (row as { last_match_id: string }).last_match_id,
    action: "delete",
    changed_by: auth.employeeCode,
    before: { ...(row as object), lead_id: leadId },
    after: null,
  });

  revalidatePath("/last-match");
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/");
  return { ok: true };
}
