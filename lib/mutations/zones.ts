"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import { zoneCodeConflict } from "@/lib/zones";

// Zone master data (ตั้งค่า → โซน). All four actions are gated on `masterdata.govern`,
// matching the RLS on `zone` and `zone_sales`.
//
// ⚠️ `zone_id` is part of every listing_id (`<type><zone><number>`, no separator), so it is
// created once and never renamed — renaming would orphan every listing id that embeds it.
// Only the Thai/English names are editable.

type Result = { ok: true } | { ok: false; error: string };

type Governed = { employeeCode: string } | { error: string };

async function requireGovern(): Promise<Governed> {
  const auth = await getAuthContext();
  if (!auth?.employeeCode) return { error: "ไม่พบสิทธิ์ผู้ใช้ กรุณาเข้าสู่ระบบใหม่" };
  const perms = new Set(auth.permissions);
  if (!(perms.has("masterdata.govern") || perms.has("roles.manage"))) {
    return { error: "ไม่มีสิทธิ์จัดการโซน" };
  }
  return { employeeCode: auth.employeeCode };
}

function done() {
  revalidatePath("/settings");
  revalidatePath("/listings");
  revalidatePath("/team");
}

export async function createZone(
  code: string,
  nameThai: string,
  nameEng: string
): Promise<Result> {
  const auth = await requireGovern();
  if ("error" in auth) return { ok: false, error: auth.error };

  const supabase = await createClient();
  const { data: existing } = await supabase.from("zone").select("zone_id");
  const conflict = zoneCodeConflict(
    code,
    ((existing ?? []) as { zone_id: string }[]).map((z) => z.zone_id)
  );
  if (conflict) return { ok: false, error: conflict };
  if (!nameThai.trim()) return { ok: false, error: "ต้องใส่ชื่อโซนภาษาไทย" };

  const zoneId = code.trim().toUpperCase();
  const { error } = await supabase.from("zone").insert({
    zone_id: zoneId,
    name_thai: nameThai.trim(),
    name_eng: nameEng.trim() || null,
  });
  if (error) return { ok: false, error: error.message };

  await supabase.from("audit_log").insert({
    entity: "zone",
    entity_id: zoneId,
    action: "create",
    changed_by: auth.employeeCode,
    before: {},
    after: { name_thai: nameThai.trim(), name_eng: nameEng.trim() || null },
  });
  done();
  return { ok: true };
}

export async function renameZone(
  zoneId: string,
  nameThai: string,
  nameEng: string
): Promise<Result> {
  const auth = await requireGovern();
  if ("error" in auth) return { ok: false, error: auth.error };
  if (!nameThai.trim()) return { ok: false, error: "ต้องใส่ชื่อโซนภาษาไทย" };

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("zone")
    .select("name_thai,name_eng")
    .eq("zone_id", zoneId)
    .maybeSingle();
  if (!current) return { ok: false, error: "ไม่พบโซนนี้" };

  const { error } = await supabase
    .from("zone")
    .update({ name_thai: nameThai.trim(), name_eng: nameEng.trim() || null })
    .eq("zone_id", zoneId);
  if (error) return { ok: false, error: error.message };

  await supabase.from("audit_log").insert({
    entity: "zone",
    entity_id: zoneId,
    action: "rename",
    changed_by: auth.employeeCode,
    before: current,
    after: { name_thai: nameThai.trim(), name_eng: nameEng.trim() || null },
  });
  done();
  return { ok: true };
}

export async function deleteZone(zoneId: string): Promise<Result> {
  const auth = await requireGovern();
  if ("error" in auth) return { ok: false, error: auth.error };

  const supabase = await createClient();
  // The FK from main_4_listing_database would refuse anyway; checking first turns a raw
  // constraint error into a sentence that says how many listings are in the way.
  const { count } = await supabase
    .from("main_4_listing_database")
    .select("listing_id", { count: "exact", head: true })
    .eq("zone", zoneId);
  if (count) {
    return { ok: false, error: `ลบไม่ได้ — มีทรัพย์ ${count} รายการอยู่ในโซนนี้` };
  }

  await supabase.from("zone_sales").delete().eq("zone_id", zoneId);
  const { error } = await supabase.from("zone").delete().eq("zone_id", zoneId);
  if (error) return { ok: false, error: error.message };

  await supabase.from("audit_log").insert({
    entity: "zone",
    entity_id: zoneId,
    action: "delete",
    changed_by: auth.employeeCode,
    before: { zone_id: zoneId },
    after: {},
  });
  done();
  return { ok: true };
}

/**
 * Replace the whole set of agents covering a zone.
 *
 * Sent as a set rather than add/remove calls because `is_primary` has a partial unique
 * index (one เจ้าภาพ per zone): moving it between two agents is a delete-then-insert that
 * would trip the index if the old holder were still present.
 */
export async function setZoneSales(
  zoneId: string,
  codes: string[],
  primaryCode: string | null
): Promise<Result> {
  const auth = await requireGovern();
  if ("error" in auth) return { ok: false, error: auth.error };

  const unique = [...new Set(codes.filter(Boolean))];
  if (primaryCode && !unique.includes(primaryCode)) {
    return { ok: false, error: "เจ้าภาพโซนต้องเป็นหนึ่งในเซลที่ดูแลโซนนี้" };
  }

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("zone_sales")
    .select("employee_code,is_primary")
    .eq("zone_id", zoneId);

  const { error: delErr } = await supabase.from("zone_sales").delete().eq("zone_id", zoneId);
  if (delErr) return { ok: false, error: delErr.message };

  if (unique.length) {
    const { error } = await supabase.from("zone_sales").insert(
      unique.map((code) => ({
        zone_id: zoneId,
        employee_code: code,
        is_primary: code === primaryCode,
      }))
    );
    if (error) return { ok: false, error: error.message };
  }

  await supabase.from("audit_log").insert({
    entity: "zone_sales",
    entity_id: zoneId,
    action: "set_sales",
    changed_by: auth.employeeCode,
    before: { sales: before ?? [] },
    after: { sales: unique, primary: primaryCode },
  });
  done();
  return { ok: true };
}
