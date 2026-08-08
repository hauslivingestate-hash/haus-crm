"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext } from "@/lib/auth";

// Account management (Settings → บัญชีผู้ใช้, gated to `people.manage_accounts` — CEO / HR /
// system_admin only). Two actions, same shape as every other mutation in this app: check the
// permission server-side via the session client (never trust the UI alone), do the write,
// audit it, revalidate.
//
// The one thing genuinely different here: creating or resetting a login requires
// `auth.admin.*`, which only the service-role client can call. That client bypasses RLS
// entirely, so the permission check below is the ONLY thing standing between a caller and
// resetting anyone's password — get it right, and never skip it.

type Result = { ok: true } | { ok: false; error: string };

async function requireManageAccounts() {
  const auth = await getAuthContext();
  if (!auth?.employeeCode) return { ok: false as const, error: "ไม่พบสิทธิ์ผู้ใช้ กรุณาเข้าสู่ระบบใหม่" };
  if (!auth.permissions.includes("people.manage_accounts")) {
    return { ok: false as const, error: "ไม่มีสิทธิ์จัดการบัญชีผู้ใช้" };
  }
  return { ok: true as const, employeeCode: auth.employeeCode };
}

export async function resetUserPassword(employeeCode: string, newPassword: string): Promise<Result> {
  const gate = await requireManageAccounts();
  if (!gate.ok) return gate;

  const supabase = await createClient();
  const { data: employee, error: fetchError } = await supabase
    .from("main_1_hr")
    .select("nickname,auth_user_id")
    .eq("employee_code", employeeCode)
    .maybeSingle();
  if (fetchError || !employee) return { ok: false, error: fetchError?.message ?? "ไม่พบพนักงานคนนี้" };
  if (!employee.auth_user_id) return { ok: false, error: "พนักงานคนนี้ยังไม่มีบัญชี — ใช้ปุ่มสร้างบัญชีแทน" };

  const { error: resetError } = await createAdminClient().auth.admin.updateUserById(
    employee.auth_user_id,
    { password: newPassword }
  );
  if (resetError) return { ok: false, error: resetError.message };

  await supabase.from("audit_log").insert({
    entity: "auth.users",
    entity_id: employeeCode,
    action: "reset_password",
    changed_by: gate.employeeCode,
    before: null,
    after: { employeeCode, nickname: employee.nickname },
  });

  revalidatePath("/settings");
  return { ok: true };
}

export async function createUserAccount(
  employeeCode: string,
  email: string,
  password: string
): Promise<Result> {
  const gate = await requireManageAccounts();
  if (!gate.ok) return gate;

  const supabase = await createClient();
  const { data: employee, error: fetchError } = await supabase
    .from("main_1_hr")
    .select("nickname,auth_user_id")
    .eq("employee_code", employeeCode)
    .maybeSingle();
  if (fetchError || !employee) return { ok: false, error: fetchError?.message ?? "ไม่พบพนักงานคนนี้" };
  if (employee.auth_user_id) return { ok: false, error: "พนักงานคนนี้มีบัญชีอยู่แล้ว — ใช้ปุ่มตั้งรหัสผ่านใหม่แทน" };

  const { data: created, error: createError } = await createAdminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true, // skip the confirmation-email flow — same as the original 9 accounts
  });
  if (createError || !created.user) {
    return { ok: false, error: createError?.message ?? "สร้างบัญชีไม่สำเร็จ" };
  }

  const { error: linkError } = await supabase
    .from("main_1_hr")
    .update({ auth_user_id: created.user.id, email })
    .eq("employee_code", employeeCode);
  if (linkError) {
    // The auth account now exists but isn't linked — surfacing this precisely matters,
    // because retrying createUserAccount would just fail on "email already registered".
    return {
      ok: false,
      error: `สร้างบัญชีสำเร็จแต่ผูกกับพนักงานไม่สำเร็จ (${linkError.message}) — แจ้งผู้ดูแลระบบ`,
    };
  }

  await supabase.from("audit_log").insert({
    entity: "auth.users",
    entity_id: employeeCode,
    action: "create_account",
    changed_by: gate.employeeCode,
    before: null,
    after: { employeeCode, nickname: employee.nickname, email },
  });

  revalidatePath("/settings");
  return { ok: true };
}
