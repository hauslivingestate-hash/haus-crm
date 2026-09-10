"use server";

import { revalidatePath } from "next/cache";
import { PERIOD_ORDER, type PeriodLength } from "@/lib/range";
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
  /** Whose target. Omit for your own.
   *
   *  Setting SOMEBODY ELSE'S is how a CEO gives a sale their number (Ben, 2026-09-10:
   *  "only the CEO is the one who will set the target for sales, not themselves"). It is
   *  restricted to `official` targets on purpose — a stretch goal is the sale's own
   *  private extra, and a leader writing one into somebody's account would be putting
   *  words in their mouth. RLS enforces the same rule independently (targets.p_insert). */
  employeeCode?: string;
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

function gate(perms: Set<string>, owner: TargetOwner, forSomeoneElse: boolean): string | null {
  if (perms.has("roles.manage")) return null;
  // Writing into another person's account is a leadership act, and only for the official
  // number. Checked before the owner gate so the message names the real reason.
  if (forSomeoneElse) {
    if (owner !== "official") return "ตั้งเป้าหมายส่วนตัวให้คนอื่นไม่ได้";
    return perms.has("targets.set") ? null : "ไม่มีสิทธิ์ตั้งเป้าหมายให้พนักงานคนอื่น";
  }
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
  const employeeCode = input.employeeCode?.trim() || auth.employeeCode;
  const denied = gate(new Set(auth.permissions), input.owner, employeeCode !== auth.employeeCode);
  if (denied) return { ok: false, error: denied };
  if (!input.label?.trim()) return { ok: false, error: "กรุณากรอกชื่อเป้าหมาย" };
  if (!(input.target > 0)) return { ok: false, error: "เป้าหมายต้องมากกว่า 0" };

  const columns = {
    employee_code: employeeCode,
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
  // The dashboard reads the same row for its เป้ารายได้ bar, and a leader who just set
  // somebody's number is looking at the page they set it from.
  revalidatePath("/");
  revalidatePath("/team");
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

  const denied = gate(new Set(auth.permissions), current.owner as TargetOwner, false);
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

  const denied = gate(new Set(auth.permissions), current.owner as TargetOwner, false);
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

/**
 * Set one sale's official revenue targets — all five period lengths at once.
 *
 * ── FIVE, NOT ONE ───────────────────────────────────────────────────────────────
 * The dashboard's bar has to have a real denominator whatever the filter says, and the
 * denominator may never be a monthly figure divided by days: Thai property is not flat
 * across the year and a Songkran month is not a March. So the leader sets a real number
 * per length, and the range picks the matching one. Same design as Klaichan CRM, which
 * hit and rejected the pro-rated version first.
 *
 * ── STANDING ROWS ───────────────────────────────────────────────────────────────
 * These are `period_key = ''` — they apply to every period of that length until changed.
 * A one-off override for a single month is a separate row and is not written here.
 *
 * ── 0 DELETES, IT DOES NOT STORE ZERO ───────────────────────────────────────────
 * "No target set" and "your target is nothing" are different states and the card draws
 * them differently — one invites a target, the other reads as a judgement.
 *
 * Idempotent: a unique index (targets_one_per_period) makes a double save impossible to
 * turn into two rows, which would make the dashboard silently read double.
 *
 * Gated on `targets.set`. Ben, 2026-09-10: the CEO sets the sale's number, not the sale.
 * RLS enforces the same rule independently, so a crafted request cannot route around it.
 */
export async function setRevenueTargets(
  employeeCode: string,
  amounts: Partial<Record<PeriodLength, number>>
): Promise<Result> {
  const auth = await requireAuth();
  if (!auth) return { ok: false, error: "ไม่พบสิทธิ์ผู้ใช้ กรุณาเข้าสู่ระบบใหม่" };
  const perms = new Set(auth.permissions);
  if (!(perms.has("targets.set") || perms.has("roles.manage"))) {
    return { ok: false, error: "ไม่มีสิทธิ์ตั้งเป้าหมายให้พนักงาน" };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("targets")
    .select("id,period,target")
    .eq("employee_code", employeeCode)
    .eq("owner", "official")
    .eq("source", "revenue")
    .eq("period_key", "");
  const byPeriod = new Map(
    ((existing ?? []) as { id: number; period: string; target: number }[]).map((r) => [r.period, r])
  );

  for (const period of PERIOD_ORDER) {
    const raw = amounts[period];
    if (raw === undefined) continue;
    if (!Number.isFinite(raw)) return { ok: false, error: "ยอดเป้าหมายต้องเป็นตัวเลข" };
    const amount = Math.max(0, Math.round(raw));
    const row = byPeriod.get(period);

    if (amount <= 0) {
      if (!row) continue;
      const { error } = await supabase.from("targets").delete().eq("id", row.id);
      if (error) return { ok: false, error: error.message };
      await writeAudit(supabase, auth.employeeCode, row.id, "delete", { target: row.target }, {});
    } else if (row) {
      if (Number(row.target) === amount) continue; // no-op; do not write an audit row for it
      const { error } = await supabase.from("targets").update({ target: amount }).eq("id", row.id);
      if (error) return { ok: false, error: error.message };
      await writeAudit(supabase, auth.employeeCode, row.id, "update", { target: row.target }, { target: amount });
    } else {
      const insert = {
        employee_code: employeeCode,
        // Revenue targets are period-based, not month-based — `month` belongs to
        // แผนวันนี้'s per-month KPI goals, which are a different animal.
        month: null,
        period,
        period_key: "",
        label: "เป้ารายได้",
        kind: "baht",
        target: amount,
        manual_current: 0,
        source: "revenue",
        activity_type: null,
        owner: "official",
      };
      const { data, error } = await supabase.from("targets").insert(insert).select("id").single();
      if (error || !data) return { ok: false, error: error?.message ?? "ตั้งเป้าหมายไม่สำเร็จ" };
      await writeAudit(supabase, auth.employeeCode, data.id as number, "create", {}, insert);
    }
  }

  revalidatePath("/today");
  revalidatePath("/");
  revalidatePath(`/team/${employeeCode}`);
  return { ok: true };
}
