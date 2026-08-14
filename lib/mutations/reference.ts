"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";

// ตั้งค่า → ข้อมูลอ้างอิงกลาง (ประเภททรัพย์ · ช่องทาง/ฟิลด์ลีด · แท็กลีด · ประเภทกิจกรรม).
//
// These lists were edited in MasterDataProvider — React state — so the CEO could add a
// marketing channel, watch it appear in the intake form, and lose it on reload. Worse than
// losing it: the seeded ids are not the DB values, so anything saved against them would
// have failed its FK.
//
// ⚠️ THESE TABLES ARE KEYED ON THE LABEL ITSELF. That is the project convention (lookup PK
// = name, so dropdowns show words rather than numbers), and every FK to them is
// ON UPDATE CASCADE — verified, all 20 of them. So a rename here really does rewrite the
// value on every listing/lead/activity that holds it, which is the intended behaviour.
// DELETE is ON DELETE NO ACTION everywhere, so removing a value in use is refused by the
// database; the count is checked first to say so in Thai.

type Result = { ok: true } | { ok: false; error: string };

/**
 * The tables this action may touch, and where each is referenced.
 *
 * A whitelist rather than a free table name: this runs with the caller's session, but
 * accepting an arbitrary table from the client would still let anyone with the permission
 * rewrite tables this screen was never meant to reach.
 */
const LOOKUPS = {
  property_type: {
    label: "ประเภททรัพย์",
    // Where the value is stored, for the "still in use" check.
    uses: [
      { table: "main_4_listing_database", column: "property_type", noun: "ทรัพย์" },
      { table: "main_3_property_detail", column: "property_type", noun: "โครงการ" },
      { table: "main_7_last_match", column: "property_type", noun: "ดีลที่ปิด" },
    ],
  },
  marketing_channel: {
    label: "ช่องทางการตลาด",
    uses: [{ table: "main_6_buyer_crm", column: "marketing_channel", noun: "ลีด" }],
  },
  contact_by: {
    label: "วิธีติดต่อ",
    uses: [{ table: "main_6_buyer_crm", column: "contact_by", noun: "ลีด" }],
  },
  gender: {
    label: "เพศ",
    uses: [
      { table: "main_6_buyer_crm", column: "gender", noun: "ลีด" },
      { table: "main_1_hr", column: "gender", noun: "พนักงาน" },
    ],
  },
  nationality: {
    label: "สัญชาติ",
    uses: [
      { table: "main_6_buyer_crm", column: "nationality", noun: "ลีด" },
      { table: "main_1_hr", column: "nationality", noun: "พนักงาน" },
    ],
  },
  action_type: {
    label: "ประเภทกิจกรรม",
    uses: [
      { table: "activities", column: "action", noun: "กิจกรรมที่บันทึกไว้" },
      { table: "tasks", column: "activity_type", noun: "งานในแผน" },
      { table: "rank_criterion", column: "activity_type", noun: "เกณฑ์ Rank" },
    ],
  },
} as const;

export type LookupTable = keyof typeof LOOKUPS;

async function requireManage(): Promise<{ employeeCode: string } | { error: string }> {
  const auth = await getAuthContext();
  if (!auth?.employeeCode) return { error: "ไม่พบสิทธิ์ผู้ใช้ กรุณาเข้าสู่ระบบใหม่" };
  const perms = new Set(auth.permissions);
  // Matches the RLS on these tables (rls_policies.sql §2).
  if (
    !(
      perms.has("reference.manage") ||
      perms.has("masterdata.govern") ||
      perms.has("roles.manage")
    )
  ) {
    return { error: "ไม่มีสิทธิ์แก้ข้อมูลอ้างอิงกลาง" };
  }
  return { employeeCode: auth.employeeCode };
}

function done() {
  // Every form in the app reads these lists.
  revalidatePath("/settings");
  revalidatePath("/listings");
  revalidatePath("/leads");
  revalidatePath("/today");
}

export async function addLookupValue(
  table: LookupTable,
  name: string,
  /** property_type only — the letter that starts every listing_id of this type. */
  code?: string
): Promise<Result> {
  const auth = await requireManage();
  if ("error" in auth) return { ok: false, error: auth.error };
  const value = name.trim();
  if (!value) return { ok: false, error: "ต้องใส่ชื่อ" };

  const supabase = await createClient();
  const row: Record<string, unknown> = { name: value };
  // ⚠️ property_type.code is NOT NULL and is the first character of every listing_id
  // (CASK020 = C + ASK + 020). Two types may share a code — บ้านเดี่ยว and บ้านแฝด are both
  // H — so it is not unique, but it cannot be blank.
  if (table === "property_type") {
    const c = (code ?? "").trim().toUpperCase();
    if (!/^[A-Z]$/.test(c)) {
      return { ok: false, error: "ต้องใส่รหัส 1 ตัวอักษร (A-Z) — รหัสนี้เป็นตัวแรกของรหัสทรัพย์" };
    }
    row.code = c;
  }
  // action_type carries more than a name; without a group it falls out of every grouped
  // dropdown in the app.
  if (table === "action_type") {
    row.group_label = "อื่นๆ";
    row.attach = "either";
    row.is_active = true;
    row.sort_order = 999;
  }
  const { error } = await supabase.from(table).insert(row);
  if (error) {
    if (error.code === "23505") return { ok: false, error: `“${value}” มีอยู่แล้ว` };
    return { ok: false, error: error.message };
  }

  await supabase.from("audit_log").insert({
    entity: table,
    entity_id: value,
    action: "create",
    changed_by: auth.employeeCode,
    before: {},
    after: { name: value },
  });
  done();
  return { ok: true };
}

/**
 * Rename a value.
 *
 * This rewrites the PK, and every FK cascades — so a listing that said "คอนโด" says the new
 * word afterwards. That is the point of keying lookups on the label, but it means a typo
 * fixed here is a typo fixed everywhere, and a rename to something different is a
 * reclassification of existing rows. The UI says so before committing.
 */
export async function renameLookupValue(
  table: LookupTable,
  from: string,
  to: string
): Promise<Result> {
  const auth = await requireManage();
  if ("error" in auth) return { ok: false, error: auth.error };
  const value = to.trim();
  if (!value) return { ok: false, error: "ต้องใส่ชื่อ" };
  if (value === from) return { ok: true };

  const supabase = await createClient();
  const { error } = await supabase.from(table).update({ name: value }).eq("name", from);
  if (error) {
    if (error.code === "23505") return { ok: false, error: `“${value}” มีอยู่แล้ว` };
    return { ok: false, error: error.message };
  }

  await supabase.from("audit_log").insert({
    entity: table,
    entity_id: value,
    action: "rename",
    changed_by: auth.employeeCode,
    before: { name: from },
    after: { name: value },
  });
  done();
  return { ok: true };
}

export async function deleteLookupValue(table: LookupTable, name: string): Promise<Result> {
  const auth = await requireManage();
  if ("error" in auth) return { ok: false, error: auth.error };

  const supabase = await createClient();
  // The FK would refuse anyway (ON DELETE NO ACTION); counting first turns a raw constraint
  // error into a sentence naming what is in the way.
  for (const use of LOOKUPS[table].uses) {
    const { count } = await supabase
      .from(use.table)
      .select("*", { count: "exact", head: true })
      .eq(use.column, name);
    if (count) {
      return { ok: false, error: `ลบไม่ได้ — มี${use.noun} ${count} รายการใช้ค่านี้อยู่` };
    }
  }

  const { error } = await supabase.from(table).delete().eq("name", name);
  if (error) return { ok: false, error: error.message };

  await supabase.from("audit_log").insert({
    entity: table,
    entity_id: name,
    action: "delete",
    changed_by: auth.employeeCode,
    before: { name },
    after: {},
  });
  done();
  return { ok: true };
}

// ── Lead tags — same screen, different shape ────────────────────────────────
// `lead_tags_ref` is keyed on an opaque id and stores a `tone`, because the whole point of
// a company-standard tag is that everyone sees it in the same colour. Renaming a tag here
// therefore does NOT touch the leads holding it — the id is what they store.

export async function saveLeadTag(
  id: string,
  label: string,
  tone: string,
  isNew: boolean
): Promise<Result> {
  const auth = await requireManage();
  if ("error" in auth) return { ok: false, error: auth.error };
  if (!label.trim()) return { ok: false, error: "ต้องใส่ชื่อแท็ก" };

  const supabase = await createClient();
  const { error } = isNew
    ? await supabase.from("lead_tags_ref").insert({ id, label: label.trim(), tone, is_active: true })
    : await supabase.from("lead_tags_ref").update({ label: label.trim(), tone }).eq("id", id);
  if (error) {
    if (error.code === "23505") return { ok: false, error: "มีแท็กรหัสนี้อยู่แล้ว" };
    return { ok: false, error: error.message };
  }

  await supabase.from("audit_log").insert({
    entity: "lead_tags_ref",
    entity_id: id,
    action: isNew ? "create" : "update",
    changed_by: auth.employeeCode,
    before: {},
    after: { label: label.trim(), tone },
  });
  done();
  return { ok: true };
}

export async function deleteLeadTag(id: string): Promise<Result> {
  const auth = await requireManage();
  if ("error" in auth) return { ok: false, error: auth.error };

  const supabase = await createClient();
  const { count } = await supabase
    .from("main_6_buyer_crm")
    .select("lead_id", { count: "exact", head: true })
    .eq("tag_id", id);
  if (count) return { ok: false, error: `ลบไม่ได้ — มีลีด ${count} รายใช้แท็กนี้อยู่` };

  const { error } = await supabase.from("lead_tags_ref").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  await supabase.from("audit_log").insert({
    entity: "lead_tags_ref",
    entity_id: id,
    action: "delete",
    changed_by: auth.employeeCode,
    before: { id },
    after: {},
  });
  done();
  return { ok: true };
}
