"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";

/* ทรัพย์ที่สนใจ — the units a buyer is shopping.
 *
 * ── TWO COLUMNS, TWO DIFFERENT FACTS ────────────────────────────────────────────
 * There is an older single-listing column, main_6_buyer_crm.listing_code, and it is NOT
 * replaced by this table. They answer different questions, and keeping them apart is what
 * stops this from becoming two copies of one fact:
 *
 *   lead_listing_interest   every unit this buyer is interested in.        MANY
 *   main_6_buyer_crm        the unit the DEAL is about — what the closing   ONE
 *     .listing_code         card prices against, what gets marked
 *                           Sold Completed, where sale_id is derived from.
 *
 * A buyer looks at four condos and buys one. The four are interests; the one is the deal.
 *
 * ── THE ONE RULE THAT KEEPS THEM HONEST ─────────────────────────────────────────
 * `listing_code` is only ever auto-set when it is EMPTY — the first interest added fills
 * it, so a lead with one interest behaves exactly as it did before this table existed and
 * every existing consumer keeps working untouched. After that it is left alone: removing an
 * interest never clears it, because a deal in progress must not lose its unit just because
 * someone tidied the shopping list.
 *
 * ⚠️ So `listing_code` can name a listing that is not in the interest list. That is not
 * drift — it is a deal that outlived the browsing. Anything that needs "what are they
 * looking at" reads this table; anything that needs "what are they buying" reads the column.
 */

type Result = { ok: true } | { ok: false; error: string };

async function gate(): Promise<{ error: string } | { employeeCode: string }> {
  const auth = await getAuthContext();
  if (!auth?.employeeCode) return { error: "ไม่พบสิทธิ์ผู้ใช้ กรุณาเข้าสู่ระบบใหม่" };
  const perms = new Set(auth.permissions);
  if (!(perms.has("leads.edit") || perms.has("leads.assign") || perms.has("roles.manage"))) {
    return { error: "ไม่มีสิทธิ์แก้ไข Lead" };
  }
  return { employeeCode: auth.employeeCode };
}

function done(leadId: string, listingId: string) {
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  // The listing's ผู้สนใจ card reads the other side of this row.
  revalidatePath(`/listings/${listingId}`);
}

export async function addLeadInterest(leadId: string, listingId: string): Promise<Result> {
  const auth = await gate();
  if ("error" in auth) return { ok: false, error: auth.error };

  const code = listingId.trim().toUpperCase();
  if (!code) return { ok: false, error: "กรุณาเลือกทรัพย์" };

  const supabase = await createClient();

  // Checked before the insert so a mistyped code says which code was wrong, rather than
  // surfacing "violates foreign key constraint lead_listing_interest_listing_id_fkey".
  const { data: listing } = await supabase
    .from("main_4_listing_database")
    .select("listing_id")
    .eq("listing_id", code)
    .maybeSingle();
  if (!listing) return { ok: false, error: `ไม่พบทรัพย์รหัส ${code}` };

  const { error } = await supabase
    .from("lead_listing_interest")
    .insert({ lead_id: leadId, listing_id: code, created_by: auth.employeeCode });
  // 23505 = already on the list. Adding it twice is a no-op, not a failure worth a red box.
  if (error && error.code !== "23505") return { ok: false, error: error.message };

  /* Fill the deal's unit only if nothing has claimed it. See the header: the first interest
     seeds it so single-listing leads behave as before, and it is never overwritten after. */
  const { data: lead } = await supabase
    .from("main_6_buyer_crm")
    .select("listing_code")
    .eq("lead_id", leadId)
    .maybeSingle();
  if (lead && !(lead as { listing_code: string | null }).listing_code) {
    await supabase
      .from("main_6_buyer_crm")
      .update({ listing_code: code })
      .eq("lead_id", leadId);
  }

  done(leadId, code);
  return { ok: true };
}

export async function removeLeadInterest(leadId: string, listingId: string): Promise<Result> {
  const auth = await gate();
  if ("error" in auth) return { ok: false, error: auth.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("lead_listing_interest")
    .delete()
    .eq("lead_id", leadId)
    .eq("listing_id", listingId);
  if (error) return { ok: false, error: error.message };

  // `listing_code` is deliberately NOT cleared here — see the header. A deal being priced
  // against this unit must survive someone tidying the browsing list.
  done(leadId, listingId);
  return { ok: true };
}
