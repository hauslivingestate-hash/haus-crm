"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import type { LeaveStatus } from "@/lib/leave";

// Phase 6 — วันลา writes. Three actions, each mirroring a policy already on the table:
//   submit   — leave.request, and only in your own name
//   decide   — leave.manage (the approval step the source sheet never had)
//   withdraw — your own row, or leave.manage
//
// ⚠️ RLS UPDATE on leave_requests is `leave.manage OR own row`, which is deliberately wider
// than "may approve": it also lets someone edit their own pending request. So `decide()`
// re-checks `leave.manage` in the app — without that, an agent could approve their own leave
// by calling the action directly.

type Result = { ok: true } | { ok: false; error: string };

async function requireAuth() {
  const auth = await getAuthContext();
  if (!auth?.employeeCode) return null;
  return { ...auth, employeeCode: auth.employeeCode };
}

function revalidate() {
  revalidatePath("/leave");
  revalidatePath("/today");
}

export interface LeaveDraft {
  startDate: string;
  endDate: string;
  type: string;
  remark?: string | null;
}

export async function submitLeave(draft: LeaveDraft): Promise<Result> {
  const auth = await requireAuth();
  if (!auth) return { ok: false, error: "ไม่พบสิทธิ์ผู้ใช้ กรุณาเข้าสู่ระบบใหม่" };
  const perms = new Set(auth.permissions);
  if (!(perms.has("leave.request") || perms.has("leave.manage") || perms.has("roles.manage"))) {
    return { ok: false, error: "ไม่มีสิทธิ์ขอลา" };
  }
  if (!draft.startDate || !draft.endDate) return { ok: false, error: "กรุณาระบุวันที่" };
  // The table has a start <= end check; catching it here gives a Thai message instead of a
  // raw constraint violation. (The source sheet had a row with the end before the start.)
  if (draft.endDate < draft.startDate) {
    return { ok: false, error: "วันสิ้นสุดต้องไม่ก่อนวันเริ่ม" };
  }
  if (!draft.type) return { ok: false, error: "กรุณาเลือกประเภทการลา" };

  const supabase = await createClient();
  // Always in your own name — the form has no "file for someone else" path, and the INSERT
  // policy would refuse it anyway.
  const { error } = await supabase.from("leave_requests").insert({
    employee_code: auth.employeeCode,
    start_date: draft.startDate,
    end_date: draft.endDate,
    type: draft.type,
    remark: draft.remark?.trim() || null,
    status: "pending",
  });
  if (error) {
    // unique (employee, start, end, type) — the sheet had exact duplicate rows, hence the key.
    if (error.code === "23505") return { ok: false, error: "มีใบลาช่วงวันนี้อยู่แล้ว" };
    return { ok: false, error: error.message };
  }

  await supabase.from("audit_log").insert({
    entity: "leave_requests",
    entity_id: `${auth.employeeCode} ${draft.startDate}..${draft.endDate}`,
    action: "submit",
    changed_by: auth.employeeCode,
    before: {},
    after: { type: draft.type, start_date: draft.startDate, end_date: draft.endDate },
  });

  revalidate();
  return { ok: true };
}

/**
 * The annual quota per leave type (ตั้งค่า → โควตาวันลา).
 *
 * `null` days means "not drawn from an annual pool" (maternity, sterilisation) — a real
 * setting, not a missing one, so it is written as NULL rather than skipped.
 */
export async function setLeaveAllowance(
  type: string,
  daysPerYear: number | null
): Promise<Result> {
  const auth = await requireAuth();
  if (!auth) return { ok: false, error: "ไม่พบสิทธิ์ผู้ใช้ กรุณาเข้าสู่ระบบใหม่" };
  const perms = new Set(auth.permissions);
  if (!(perms.has("leave.manage") || perms.has("roles.manage"))) {
    return { ok: false, error: "ไม่มีสิทธิ์แก้โควตาวันลา" };
  }
  if (daysPerYear != null && (!Number.isFinite(daysPerYear) || daysPerYear < 0)) {
    return { ok: false, error: "จำนวนวันต้องไม่ติดลบ" };
  }

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("leave_allowances")
    .select("type,days_per_year")
    .eq("type", type)
    .maybeSingle();

  const { error } = await supabase
    .from("leave_allowances")
    .upsert({ type, days_per_year: daysPerYear }, { onConflict: "type" });
  if (error) return { ok: false, error: error.message };

  await supabase.from("audit_log").insert({
    entity: "leave_allowances",
    entity_id: type,
    action: "set_quota",
    changed_by: auth.employeeCode,
    before: { days_per_year: current?.days_per_year ?? null },
    after: { days_per_year: daysPerYear },
  });

  revalidatePath("/settings");
  revalidate();
  return { ok: true };
}

export async function decideLeave(
  id: number,
  status: Exclude<LeaveStatus, "pending">
): Promise<Result> {
  const auth = await requireAuth();
  if (!auth) return { ok: false, error: "ไม่พบสิทธิ์ผู้ใช้ กรุณาเข้าสู่ระบบใหม่" };
  const perms = new Set(auth.permissions);
  if (!(perms.has("leave.manage") || perms.has("roles.manage"))) {
    return { ok: false, error: "ไม่มีสิทธิ์อนุมัติใบลา" };
  }

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("leave_requests")
    .select("id,employee_code,status")
    .eq("id", id)
    .maybeSingle();
  if (!current) return { ok: false, error: "ไม่พบใบลานี้" };

  const { error } = await supabase
    .from("leave_requests")
    .update({ status, decided_by: auth.employeeCode, decided_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  await supabase.from("audit_log").insert({
    entity: "leave_requests",
    entity_id: String(id),
    action: status === "approved" ? "approve" : "reject",
    changed_by: auth.employeeCode,
    before: { status: current.status },
    after: { status },
  });

  revalidate();
  return { ok: true };
}

export async function withdrawLeave(id: number): Promise<Result> {
  const auth = await requireAuth();
  if (!auth) return { ok: false, error: "ไม่พบสิทธิ์ผู้ใช้ กรุณาเข้าสู่ระบบใหม่" };

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("leave_requests")
    .select("id,employee_code,status")
    .eq("id", id)
    .maybeSingle();
  if (!current) return { ok: false, error: "ไม่พบใบลานี้" };

  const perms = new Set(auth.permissions);
  const isMine = current.employee_code === auth.employeeCode;
  if (!isMine && !(perms.has("leave.manage") || perms.has("roles.manage"))) {
    return { ok: false, error: "ยกเลิกได้เฉพาะใบลาของตัวเอง" };
  }
  // Withdrawing after a decision would erase the record of that decision.
  if (current.status !== "pending") {
    return { ok: false, error: "ใบลานี้ตัดสินไปแล้ว ยกเลิกไม่ได้" };
  }

  const { error } = await supabase.from("leave_requests").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  await supabase.from("audit_log").insert({
    entity: "leave_requests",
    entity_id: String(id),
    action: "withdraw",
    changed_by: auth.employeeCode,
    before: { employee_code: current.employee_code, status: current.status },
    after: {},
  });

  revalidate();
  return { ok: true };
}
