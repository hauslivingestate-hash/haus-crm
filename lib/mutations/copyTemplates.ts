"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import { defaultTemplate, splitKey, type CopyTemplate } from "@/lib/listingCopy";

// เทมเพลตคำโฆษณา (ตั้งค่า → คำโฆษณา) — the 3×3 matrix of Grade × ขาย/เช่า behind the
// "สร้างคำโฆษณา" drawer on every listing.
//
// The table stores OVERRIDES ONLY, not all nine combos. `defaultTemplate()` in
// lib/listingCopy.ts stays the fallback, so:
//   • an empty table still produces correct copy for every listing
//   • "คืนค่าเริ่มต้น" is a DELETE, not a write of the current default
//   • improving a code default reaches every combo nobody has edited, instead of being
//     shadowed by nine stale copies written on day one
//
// Writing requires `copy.manage` — CEO, Marketing and Listing Support hold it, which matches
// who the section says governs it.

type Result = { ok: true } | { ok: false; error: string };

async function requireCopy(): Promise<{ employeeCode: string } | { error: string }> {
  const auth = await getAuthContext();
  if (!auth?.employeeCode) return { error: "ไม่พบสิทธิ์ผู้ใช้ กรุณาเข้าสู่ระบบใหม่" };
  const perms = new Set(auth.permissions);
  if (!(perms.has("copy.manage") || perms.has("roles.manage"))) {
    return { error: "ไม่มีสิทธิ์แก้เทมเพลตคำโฆษณา" };
  }
  return { employeeCode: auth.employeeCode };
}

function refresh() {
  revalidatePath("/settings");
  revalidatePath("/listings");
}

/**
 * Save one combo. If the submitted text is identical to the code default the row is deleted
 * instead of written — an override that says nothing is worse than no override, because it
 * freezes that combo against future default changes.
 */
export async function saveCopyTemplate(key: string, tpl: CopyTemplate): Promise<Result> {
  const auth = await requireCopy();
  if ("error" in auth) return { ok: false, error: auth.error };

  const [grade, copyType] = splitKey(key);
  if (!grade || !copyType) return { ok: false, error: "ไม่รู้จักช่องเทมเพลตนี้" };
  if (!tpl.headline.trim() || !tpl.normalBody.trim() || !tpl.ddBody.trim()) {
    return { ok: false, error: "กรอกให้ครบทั้ง 3 ช่อง (Headline · โพสต์ · DDproperty)" };
  }

  const d = defaultTemplate(grade, copyType);
  const same =
    tpl.headline === d.headline && tpl.normalBody === d.normalBody && tpl.ddBody === d.ddBody;
  if (same) return resetCopyTemplate(key);

  const supabase = await createClient();
  const { error } = await supabase.from("listing_copy_template").upsert(
    {
      grade,
      copy_type: copyType,
      headline: tpl.headline,
      normal_body: tpl.normalBody,
      dd_body: tpl.ddBody,
      updated_at: new Date().toISOString(),
      updated_by: auth.employeeCode,
    },
    { onConflict: "grade,copy_type" }
  );
  if (error) return { ok: false, error: error.message };

  await supabase.from("audit_log").insert({
    entity: "listing_copy_template",
    entity_id: key,
    action: "update",
    changed_by: auth.employeeCode,
    before: {},
    after: { headline: tpl.headline },
  });

  refresh();
  return { ok: true };
}

/** Drop the override so the combo follows the code default again. */
export async function resetCopyTemplate(key: string): Promise<Result> {
  const auth = await requireCopy();
  if ("error" in auth) return { ok: false, error: auth.error };

  const [grade, copyType] = splitKey(key);
  if (!grade || !copyType) return { ok: false, error: "ไม่รู้จักช่องเทมเพลตนี้" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("listing_copy_template")
    .delete()
    .eq("grade", grade)
    .eq("copy_type", copyType);
  if (error) return { ok: false, error: error.message };

  await supabase.from("audit_log").insert({
    entity: "listing_copy_template",
    entity_id: key,
    action: "reset",
    changed_by: auth.employeeCode,
    before: {},
    after: {},
  });

  refresh();
  return { ok: true };
}
