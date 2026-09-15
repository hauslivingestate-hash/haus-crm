"use server";

import { revalidatePath } from "next/cache";
import { PERIOD_ORDER, type PeriodLength } from "@/lib/range";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";

/* Set a TEAM's official revenue targets — all five period lengths at once.
 *
 * The team twin of setRevenueTargets (lib/mutations/targets.ts) and it keeps every one
 * of that function's rules, for the same reasons:
 *   FIVE, NOT ONE     a real figure per period length; the range picks, nothing divides
 *   STANDING ROWS     period_key = '' applies to every period of that length
 *   0 DELETES         "no target" and "a target of nothing" are different states
 *   IDEMPOTENT        the unique (team_id, period, period_key) makes a double save one row
 *
 * Gated on `targets.set`, like a salesperson's number: the person who sets the sales'
 * targets is the person who sets the team's. RLS enforces the same gate independently.
 */

type Result = { ok: true } | { ok: false; error: string };

export async function setTeamRevenueTargets(
  teamId: string,
  amounts: Partial<Record<PeriodLength, number>>
): Promise<Result> {
  const auth = await getAuthContext();
  if (!auth?.employeeCode) return { ok: false, error: "ไม่พบสิทธิ์ผู้ใช้ กรุณาเข้าสู่ระบบใหม่" };
  const perms = new Set(auth.permissions);
  if (!(perms.has("targets.set") || perms.has("roles.manage"))) {
    return { ok: false, error: "ไม่มีสิทธิ์ตั้งเป้าหมายทีม" };
  }
  if (!teamId) return { ok: false, error: "ไม่พบทีม" };

  const supabase = await createClient();
  const { data: existing, error: readError } = await supabase
    .from("team_revenue_targets")
    .select("id,period,target")
    .eq("team_id", teamId)
    .eq("period_key", "");
  if (readError) return { ok: false, error: readError.message };
  const byPeriod = new Map(
    ((existing ?? []) as { id: number; period: string; target: number }[]).map((r) => [r.period, r])
  );

  const audit = (id: number, action: string, before: object, after: object) =>
    supabase.from("audit_log").insert({
      entity: "team_revenue_targets",
      entity_id: String(id),
      action,
      changed_by: auth.employeeCode,
      before,
      after,
    });

  for (const period of PERIOD_ORDER) {
    const raw = amounts[period];
    if (raw === undefined) continue;
    if (!Number.isFinite(raw)) return { ok: false, error: "ยอดเป้าหมายต้องเป็นตัวเลข" };
    const amount = Math.max(0, Math.round(raw));
    const row = byPeriod.get(period);

    if (amount <= 0) {
      if (!row) continue;
      const { error } = await supabase.from("team_revenue_targets").delete().eq("id", row.id);
      if (error) return { ok: false, error: error.message };
      await audit(row.id, "delete", { target: row.target }, {});
    } else if (row) {
      if (Number(row.target) === amount) continue; // no-op; no audit row for a save that changed nothing
      const { error } = await supabase
        .from("team_revenue_targets")
        .update({ target: amount, updated_at: new Date().toISOString() })
        .eq("id", row.id);
      if (error) return { ok: false, error: error.message };
      await audit(row.id, "update", { target: row.target }, { target: amount });
    } else {
      const insert = { team_id: teamId, period, period_key: "", target: amount };
      const { data, error } = await supabase
        .from("team_revenue_targets")
        .insert(insert)
        .select("id")
        .single();
      if (error || !data) return { ok: false, error: error?.message ?? "ตั้งเป้าหมายไม่สำเร็จ" };
      await audit(data.id as number, "create", {}, insert);
    }
  }

  revalidatePath("/");
  return { ok: true };
}
