"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import { AVATAR_BUCKET, ownerOfAvatarPath } from "@/lib/avatar";

/* รูปโปรไฟล์พนักงาน — `main_1_hr.avatar_path` + the `avatars` storage bucket.
 *
 * The FILE goes straight from the browser to Storage (see components/AvatarPicker.tsx);
 * these actions only record or clear the PATH, and delete the object that stops being
 * referenced. Same split as รูปทรัพย์ (lib/mutations/listingPhotos.ts), for the same reason:
 * pushing the bytes through a server action would double the transfer off a phone.
 *
 * ── WHO MAY CHANGE A PHOTO ──────────────────────────────────────────────────────
 * `people.manage` / `roles.manage` only — Ben, 2026-09-16: HR and the CEO set the photos,
 * not the staff. That is the same gate the ทีม record's แก้ไข button and updateEmployee use,
 * and the `avatars_*` storage policies enforce it independently, so a crafted request that
 * skips this action still cannot write to the bucket.
 *
 * ⚠️ `update` on main_1_hr is granted table-wide to `authenticated` (only `select` was ever
 * revoked per column), so this check is load-bearing. See lib/mutations/employees.ts.
 */

type Result = { ok: true } | { ok: false; error: string };

async function requireManage(): Promise<{ employeeCode: string } | { error: string }> {
  const auth = await getAuthContext();
  if (!auth?.employeeCode) return { error: "ไม่พบสิทธิ์ผู้ใช้ กรุณาเข้าสู่ระบบใหม่" };
  const perms = new Set(auth.permissions);
  if (!(perms.has("people.manage") || perms.has("roles.manage"))) {
    return { error: "ไม่มีสิทธิ์เปลี่ยนรูปโปรไฟล์" };
  }
  return { employeeCode: auth.employeeCode };
}

/* The photo shows in the app SHELL (the sidebar and the topbar), not only on the pages that
   list people — so clearing one page's cache would leave the old face in the corner of every
   other screen. Revalidating the root layout is the honest scope for a change that is
   visible on every route. */
function done(code: string) {
  revalidatePath("/", "layout");
  revalidatePath(`/team/${code}`);
}

/** Point an employee at a photo the browser has already put in the bucket. */
export async function setEmployeeAvatar(code: string, storagePath: string): Promise<Result> {
  const auth = await requireManage();
  if ("error" in auth) return { ok: false, error: auth.error };
  if (!code) return { ok: false, error: "ไม่พบพนักงานคนนี้" };

  const supabase = await createClient();

  // The path is generated client-side. Refuse anything filed under another employee, or the
  // upload would let one person's picker overwrite somebody else's folder.
  if (ownerOfAvatarPath(storagePath) !== code) {
    await supabase.storage.from(AVATAR_BUCKET).remove([storagePath]);
    return { ok: false, error: "เส้นทางไฟล์ไม่ตรงกับพนักงานคนนี้" };
  }

  // Read the outgoing photo BEFORE the update — once the column is overwritten there is
  // nothing left pointing at the old object and it would sit in the bucket forever.
  const { data: current, error: readErr } = await supabase
    .from("main_1_hr")
    .select("employee_code,avatar_path")
    .eq("employee_code", code)
    .maybeSingle();
  if (readErr) {
    await supabase.storage.from(AVATAR_BUCKET).remove([storagePath]);
    return { ok: false, error: readErr.message };
  }
  if (!current) {
    await supabase.storage.from(AVATAR_BUCKET).remove([storagePath]);
    return { ok: false, error: "ไม่พบพนักงานคนนี้" };
  }
  const previous = (current.avatar_path as string | null) ?? null;

  const { error } = await supabase
    .from("main_1_hr")
    .update({ avatar_path: storagePath })
    .eq("employee_code", code);
  if (error) {
    // The row did not take it, so the object it points at is orphaned — clean up rather
    // than leave it billing against the quota with nothing referencing it.
    await supabase.storage.from(AVATAR_BUCKET).remove([storagePath]);
    return { ok: false, error: error.message };
  }

  if (previous && previous !== storagePath) {
    await supabase.storage.from(AVATAR_BUCKET).remove([previous]);
  }

  await supabase.from("audit_log").insert({
    entity: "main_1_hr",
    entity_id: code,
    action: "set_avatar",
    changed_by: auth.employeeCode,
    before: { avatar_path: previous },
    after: { avatar_path: storagePath },
  });

  done(code);
  return { ok: true };
}

/** Clear the photo and delete the file. The person falls back to their initials. */
export async function removeEmployeeAvatar(code: string): Promise<Result> {
  const auth = await requireManage();
  if ("error" in auth) return { ok: false, error: auth.error };

  const supabase = await createClient();
  const { data: current, error: readErr } = await supabase
    .from("main_1_hr")
    .select("employee_code,avatar_path")
    .eq("employee_code", code)
    .maybeSingle();
  if (readErr) return { ok: false, error: readErr.message };
  if (!current) return { ok: false, error: "ไม่พบพนักงานคนนี้" };

  const previous = (current.avatar_path as string | null) ?? null;
  if (!previous) return { ok: true }; // already none — not an error

  const { error } = await supabase
    .from("main_1_hr")
    .update({ avatar_path: null })
    .eq("employee_code", code);
  if (error) return { ok: false, error: error.message };

  // Row first, file second: a cleared row with a stray file is invisible waste, while a
  // deleted file still referenced by a row is a broken image on every screen.
  await supabase.storage.from(AVATAR_BUCKET).remove([previous]);

  await supabase.from("audit_log").insert({
    entity: "main_1_hr",
    entity_id: code,
    action: "remove_avatar",
    changed_by: auth.employeeCode,
    before: { avatar_path: previous },
    after: { avatar_path: null },
  });

  done(code);
  return { ok: true };
}
