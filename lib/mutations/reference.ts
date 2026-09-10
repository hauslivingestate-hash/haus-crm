"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import { isPaletteToken } from "@/lib/tables/palette";
import { SLA_TABLES } from "@/lib/tables/colors";

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
  /* THE TWO PIPELINES. Both were code constants until 2026-09-10, which meant renaming a
     stage was a deploy. They are FKs on their tables, so DELETE is refused by the database
     while any record still sits on the stage — the count below is only there to say so in
     Thai first. Renaming is safe and cheap: both FKs are ON UPDATE CASCADE, so the records
     follow the new name automatically. */
  pipeline_stage: {
    label: "ขั้นตอน (ลูกค้า)",
    uses: [{ table: "main_6_buyer_crm", column: "pipeline_stage", noun: "ลีด" }],
  },
  owner_stage: {
    label: "ไปป์ไลน์เจ้าของ",
    uses: [{ table: "main_4_listing_database", column: "owner_stage", noun: "ทรัพย์" }],
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
  /* The two pipelines are ORDERED lists, and for them sort_order is not decoration: it is
     what the board columns follow and what decides whether the activity composer treats a
     move as forwards. Left NULL a new stage sorts last (Postgres puts NULLs last on ASC),
     which is at least stable — but "last" is wrong for a stage someone is adding in the
     middle of their process, and there is no way to reorder it afterwards from this screen.
     Appending explicitly at least puts it somewhere real, and it can then be renamed into
     the position the team wants. */
  if (table === "pipeline_stage" || table === "owner_stage") {
    const { data: last } = await supabase
      .from(table)
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    row.sort_order = ((last as { sort_order: number | null } | null)?.sort_order ?? 0) + 1;
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

/* ---------------------------------------------------------------- COLOURS ---
   ตั้งค่า → สีสถานะ. The colour a status/grade wears in the sheet-table grids.

   A SEPARATE WHITELIST FROM `LOOKUPS`, deliberately. These five lists are
   structural — a pipeline stage is referenced by lib/pipeline, the scoreboard
   and every funnel count — so they are NOT safe to add to, rename or delete
   from a settings screen the way a marketing channel is. Recolouring one is
   safe: nothing but the grid reads `color`, and an unknown or null token
   renders unfilled rather than breaking.

   The token is validated against PALETTE rather than accepting a hex, for the
   reason lib/tables/palette.ts gives. */
const COLORABLE = [
  "lead_status",
  "pipeline_stage",
  "potential",
  "listing_status",
  "listing_potential",
] as const;

export type ColorableTable = (typeof COLORABLE)[number];

export async function setLookupColor(
  table: string,
  name: string,
  /** A PALETTE token, or null to clear the colour and render the cell unfilled. */
  color: string | null,
): Promise<Result> {
  const auth = await requireManage();
  if ("error" in auth) return { ok: false, error: auth.error };

  if (!(COLORABLE as readonly string[]).includes(table)) {
    return { ok: false, error: "ตารางนี้ตั้งสีไม่ได้" };
  }
  if (color !== null && !isPaletteToken(color)) {
    return { ok: false, error: "สีไม่อยู่ในชุดที่กำหนด" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from(table).update({ color }).eq("name", name);
  if (error) return { ok: false, error: error.message };

  await supabase.from("audit_log").insert({
    entity: table,
    entity_id: name,
    action: "color",
    changed_by: auth.employeeCode,
    after: { color },
  });
  done();
  return { ok: true };
}

/** The follow-up window on a grade, in days. NULL = no SLA for that grade.

    Only the two GRADE lists carry one — a status is a state, not a clock.

    Zero and negative are refused rather than quietly stored: "0 days" reads as
    "chase immediately, for ever", which is what someone means by switching it
    off. Clearing the box is how you switch it off, and that is `null`. */
export async function setSlaDays(
  table: string,
  name: string,
  days: number | null,
): Promise<Result> {
  const auth = await requireManage();
  if ("error" in auth) return { ok: false, error: auth.error };

  if (!(SLA_TABLES as readonly string[]).includes(table)) {
    return { ok: false, error: "ตารางนี้ตั้ง SLA ไม่ได้" };
  }
  if (days !== null && (!Number.isInteger(days) || days < 1 || days > 365)) {
    return { ok: false, error: "จำนวนวันต้องเป็น 1–365 (เว้นว่าง = ไม่มี SLA)" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from(table).update({ sla_days: days }).eq("name", name);
  if (error) return { ok: false, error: error.message };

  await supabase.from("audit_log").insert({
    entity: table,
    entity_id: name,
    action: "sla",
    changed_by: auth.employeeCode,
    after: { sla_days: days },
  });
  done();
  return { ok: true };
}
