"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";

// Phase 6 — the ทีม record's Save. It was a console.log, which was harmless while the page
// showed sample people and is not harmless now that it shows real ones: an HR user editing
// a colleague's phone number would be told nothing and lose the edit.
//
// ⚠️ COLUMN GRANTS DO NOT GUARD WRITES HERE. `select` on salary/commission/id_card_no/
// kbank_account/payslip_drive/agreement_files is revoked from `authenticated`, but
// `update` is NOT — anyone who passes the `people.manage` policy can write them blind. So
// the money and PII groups are gated in this action, the same shape as LISTING_FIELDS in
// lib/mutations/listings.ts. Any future write path to main_1_hr must repeat this.

type Result = { ok: true } | { ok: false; error: string };

type Group = "core" | "money" | "pii";

/** Draft key → column name + which permission group it belongs to. A key that is not in
 *  here cannot be written at all, whatever the client sends. */
const FIELDS: Record<string, { col: string; group: Group; kind?: "number" | "date" }> = {
  status: { col: "status", group: "core" },
  position: { col: "position", group: "core" },
  firstNameTh: { col: "first_name_th", group: "core" },
  lastNameTh: { col: "last_name_th", group: "core" },
  firstNameEn: { col: "first_name_en", group: "core" },
  lastNameEn: { col: "last_name_en", group: "core" },
  nickname: { col: "nickname", group: "core" },
  gender: { col: "gender", group: "core" },
  nationality: { col: "nationality", group: "core" },
  birthday: { col: "birthday", group: "core", kind: "date" },
  phone: { col: "phone", group: "core" },
  phoneAlt: { col: "additional_phone", group: "core" },
  email: { col: "email", group: "core" },
  workEmail: { col: "work_email", group: "core" },
  lineUserId: { col: "line_userid", group: "core" },
  startDate: { col: "date_started", group: "core", kind: "date" },
  salesSheetUrl: { col: "sales_sheet_url", group: "core" },
  remark: { col: "remark", group: "core" },
  emergencyContact: { col: "emergency_contact", group: "core" },
  emergencyPhone: { col: "emergency_contact_phone", group: "core" },
  emergencyRelation: { col: "emergency_contact_relationship", group: "core" },

  salary: { col: "salary", group: "money", kind: "number" },
  commissionRate: { col: "commission", group: "money", kind: "number" },

  idCardNo: { col: "id_card_no", group: "pii" },
  bankAccount: { col: "kbank_account", group: "pii" },
  payslipDriveUrl: { col: "payslip_drive", group: "pii" },
  agreementFilesUrl: { col: "agreement_files", group: "pii" },
};

/** The sheet's own vocabulary — the lookup table is keyed on these exact strings. */
const STATUS_DB: Record<string, string> = { active: "Active", terminated: "Terminate" };
const GENDER_DB: Record<string, string> = { male: "Male", female: "Female" };

function coerce(key: string, raw: unknown): string | number | null {
  const spec = FIELDS[key];
  if (key === "status") return STATUS_DB[String(raw)] ?? "Active";
  if (key === "gender") return GENDER_DB[String(raw)] ?? null;
  if (spec.kind === "number") {
    if (raw === "" || raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  const s = typeof raw === "string" ? raw.trim() : raw == null ? "" : String(raw);
  // An emptied date column must become NULL, not "" — `date` would reject the empty string.
  return s === "" ? null : s;
}

export async function updateEmployee(
  code: string,
  patch: Record<string, unknown>
): Promise<Result> {
  const auth = await getAuthContext();
  if (!auth?.employeeCode) return { ok: false, error: "ไม่พบสิทธิ์ผู้ใช้ กรุณาเข้าสู่ระบบใหม่" };
  const perms = new Set(auth.permissions);
  if (!(perms.has("people.manage") || perms.has("roles.manage"))) {
    return { ok: false, error: "ไม่มีสิทธิ์แก้ไขข้อมูลพนักงาน" };
  }
  const allowed = (g: Group) =>
    g === "core" ||
    (g === "money" && perms.has("financials.view_comp")) ||
    (g === "pii" && perms.has("people.view_sensitive"));

  const supabase = await createClient();
  // Diff against the row as it stands in the DB, never against what the client claims the
  // old values were.
  const { data: current, error: readErr } = await supabase
    .from("main_1_hr")
    .select("employee_code,nickname")
    .eq("employee_code", code)
    .maybeSingle();
  if (readErr) return { ok: false, error: readErr.message };
  if (!current) return { ok: false, error: "ไม่พบพนักงานคนนี้" };

  const update: Record<string, string | number | null> = {};
  for (const [key, raw] of Object.entries(patch)) {
    const spec = FIELDS[key];
    // Unknown key, or a group this viewer may not touch → dropped silently, exactly as the
    // marketing/price split works on listings.
    if (!spec || !allowed(spec.group)) continue;
    update[spec.col] = coerce(key, raw);
  }
  if (!Object.keys(update).length) return { ok: true };

  if (update.nickname === null || update.nickname === "") {
    return { ok: false, error: "ต้องมีชื่อเล่น" };
  }

  const { error } = await supabase.from("main_1_hr").update(update).eq("employee_code", code);
  if (error) return { ok: false, error: error.message };

  await supabase.from("audit_log").insert({
    entity: "main_1_hr",
    entity_id: code,
    action: "update",
    changed_by: auth.employeeCode,
    // Column names only: the values are the pay and ID-card numbers this whole file exists
    // to keep out of reach, and audit_log is readable by anyone with roles.manage.
    before: {},
    after: { fields: Object.keys(update) },
  });

  revalidatePath("/team");
  revalidatePath(`/team/${code}`);
  return { ok: true };
}

/**
 * Create an employee row (ทีม → เพิ่มพนักงาน).
 *
 * `employee_code` is NOT accepted from the form: the `set_employee_code` trigger derives it
 * from the position (Sales→S, Support→SP, CEO→C…) and runs its own per-prefix counter.
 * Handing it a code from the client is how you collide with an existing PK.
 *
 * `second_position` decides the department everywhere else in the app, so it is written
 * explicitly rather than left for someone to fill in later.
 */
export async function createEmployee(
  patch: Record<string, unknown>,
  department: "management" | "sales" | "support"
): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const auth = await getAuthContext();
  if (!auth?.employeeCode) return { ok: false, error: "ไม่พบสิทธิ์ผู้ใช้ กรุณาเข้าสู่ระบบใหม่" };
  const perms = new Set(auth.permissions);
  if (!(perms.has("people.manage") || perms.has("roles.manage"))) {
    return { ok: false, error: "ไม่มีสิทธิ์เพิ่มพนักงาน" };
  }
  const allowed = (g: Group) =>
    g === "core" ||
    (g === "money" && perms.has("financials.view_comp")) ||
    (g === "pii" && perms.has("people.view_sensitive"));

  // The trigger reads second_position FIRST (Sales→S, Support→SP) and only falls through to
  // `position` for the C-level prefixes. Sending 'Sales' for a CEO would mint S-006 instead
  // of C-002, so management is left blank here on purpose.
  const row: Record<string, string | number | null> = {
    second_position:
      department === "support" ? "Support" : department === "sales" ? "Sales" : null,
    status: "Active",
  };
  for (const [key, raw] of Object.entries(patch)) {
    const spec = FIELDS[key];
    if (!spec || !allowed(spec.group)) continue;
    row[spec.col] = coerce(key, raw);
  }
  if (!row.nickname) return { ok: false, error: "ต้องมีชื่อเล่น" };

  const supabase = await createClient();
  // Reading the row back is what makes the generated code visible; the SELECT policy on
  // main_1_hr is `using (true)`, so unlike main_2_owner / main_5 this needs no RPC.
  const { data, error } = await supabase
    .from("main_1_hr")
    .insert(row)
    .select("employee_code")
    .single();
  if (error) return { ok: false, error: error.message };

  const code = data.employee_code as string;
  await supabase.from("audit_log").insert({
    entity: "main_1_hr",
    entity_id: code,
    action: "create",
    changed_by: auth.employeeCode,
    before: {},
    after: { nickname: row.nickname, second_position: row.second_position },
  });

  revalidatePath("/team");
  return { ok: true, code };
}
