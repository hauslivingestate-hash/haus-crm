"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import type { TargetKind, TargetOwner, TargetSource } from "@/lib/momentum";

// Phase 5 #6 (right-hand side of /today) — monthly targets.
//
// Two owners, two permissions, mirroring the RLS on `targets`:
//   • stretch   — the agent's own goals            → targets.stretch
//   • official  — the leadership-set KPI targets   → targets.set
//
// SCOPE NOTE: this writes the SIGNED-IN person's own targets only. Setting an official
// target FOR someone else needs a team screen, and `teams` is still empty, so
// `visible_employee_codes()` resolves to "just me" for everyone anyway — a cross-person
// write would be refused by RLS today regardless. That screen is Phase 6/7 work.

type Result = { ok: true } | { ok: false; error: string };
type Row = Record<string, unknown>;

async function requireAuth() {
  const auth = await getAuthContext();
  if (!auth?.employeeCode) return null;
  return { ...auth, employeeCode: auth.employeeCode };
}

async function writeAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  changedBy: string,
  targetId: number | string,
  action: string,
  before: Row,
  after: Row
) {
  await supabase.from("audit_log").insert({
    entity: "targets",
    entity_id: String(targetId),
    action,
    changed_by: changedBy,
    before,
    after,
  });
}

export interface TargetInput {
  month: string; // YYYY-MM
  label: string;
  kind: TargetKind;
  target: number;
  source: TargetSource;
  activityType?: string | null;
  owner: TargetOwner;
  denominator?: number | null;
  manualCurrent?: number | null;
}

function gate(perms: Set<string>, owner: TargetOwner): string | null {
  if (perms.has("roles.manage")) return null;
  if (owner === "official") {
    return perms.has("targets.set") ? null : "ไม่มีสิทธิ์ตั้งเป้าหมายทางการ";
  }
  return perms.has("targets.stretch") ? null : "ไม่มีสิทธิ์ตั้งเป้าหมายส่วนตัว";
}

export async function createTarget(
  input: TargetInput
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const auth = await requireAuth();
  if (!auth) return { ok: false, error: "ไม่พบสิทธิ์ผู้ใช้ กรุณาเข้าสู่ระบบใหม่" };
  const denied = gate(new Set(auth.permissions), input.owner);
  if (denied) return { ok: false, error: denied };
  if (!input.label?.trim()) return { ok: false, error: "กรุณากรอกชื่อเป้าหมาย" };
  if (!(input.target > 0)) return { ok: false, error: "เป้าหมายต้องมากกว่า 0" };

  const columns = {
    employee_code: auth.employeeCode,
    month: input.month,
    label: input.label.trim(),
    kind: input.kind,
    target: input.target,
    manual_current: input.manualCurrent ?? 0,
    denominator: input.denominator ?? null,
    source: input.source,
    // Only an activity-source target may carry an action; anything else would imply an
    // auto-tally that never runs.
    activity_type: input.source === "activity" || input.source === "kpi" ? input.activityType || null : null,
    owner: input.owner,
  };

  const supabase = await createClient();
  const { data, error } = await supabase.from("targets").insert(columns).select("id").single();
  if (error || !data) return { ok: false, error: error?.message ?? "เพิ่มเป้าหมายไม่สำเร็จ" };

  const id = data.id as number;
  await writeAudit(supabase, auth.employeeCode, id, "create", {}, columns);
  revalidatePath("/today");
  return { ok: true, id };
}

/**
 * The manual +1 tally. Only `source = "manual"` targets get this button — every other
 * source is computed (activity log) or rolled up (kpi/pipeline), so bumping one by hand
 * would be overwritten or double-counted.
 */
export async function bumpTarget(targetId: number, by = 1): Promise<Result> {
  const auth = await requireAuth();
  if (!auth) return { ok: false, error: "ไม่พบสิทธิ์ผู้ใช้ กรุณาเข้าสู่ระบบใหม่" };

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("targets")
    .select("id,manual_current,source,owner")
    .eq("id", targetId)
    .eq("employee_code", auth.employeeCode)
    .maybeSingle();
  if (!current) return { ok: false, error: "ไม่พบเป้าหมายนี้" };

  const denied = gate(new Set(auth.permissions), current.owner as TargetOwner);
  if (denied) return { ok: false, error: denied };
  if (current.source !== "manual") {
    return { ok: false, error: "เป้าหมายนี้นับอัตโนมัติ แก้ด้วยมือไม่ได้" };
  }

  const before = Number(current.manual_current ?? 0);
  const after = Math.max(0, before + by);
  const { error } = await supabase
    .from("targets")
    .update({ manual_current: after })
    .eq("id", targetId)
    .eq("employee_code", auth.employeeCode);
  if (error) return { ok: false, error: error.message };

  await writeAudit(
    supabase,
    auth.employeeCode,
    targetId,
    "bump",
    { manual_current: before },
    { manual_current: after }
  );
  revalidatePath("/today");
  return { ok: true };
}

export async function deleteTarget(targetId: number): Promise<Result> {
  const auth = await requireAuth();
  if (!auth) return { ok: false, error: "ไม่พบสิทธิ์ผู้ใช้ กรุณาเข้าสู่ระบบใหม่" };

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("targets")
    .select("*")
    .eq("id", targetId)
    .eq("employee_code", auth.employeeCode)
    .maybeSingle();
  if (!current) return { ok: false, error: "ไม่พบเป้าหมายนี้" };

  const denied = gate(new Set(auth.permissions), current.owner as TargetOwner);
  if (denied) return { ok: false, error: denied };

  // tasks.target_id is ON DELETE SET NULL, so tasks linked to this goal survive — they just
  // stop pointing at it.
  const { error } = await supabase
    .from("targets")
    .delete()
    .eq("id", targetId)
    .eq("employee_code", auth.employeeCode);
  if (error) return { ok: false, error: error.message };

  await writeAudit(supabase, auth.employeeCode, targetId, "delete", current as Row, {});
  revalidatePath("/today");
  return { ok: true };
}
