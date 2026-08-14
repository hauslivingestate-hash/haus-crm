"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import type { SalesRank } from "@/lib/probation";

// เซลล์ใหม่ — the ladder (ตั้งค่า → Rank เซลล์ใหม่) and programme membership.
//
// The ladder used to live in a React provider: the CEO could rearrange the ranks and lose
// every change on reload. It is now `probation_rank` + `rank_criterion`.
//
// Membership is deliberately stored rather than derived. Ben, 2026-08-14: the programme
// starts empty and everyone currently employed has passed. Deriving it from `date_started`
// could not express that — all ten share 2025-11-01, so any window would put the entire
// sales team on the board or none of it.

type Result = { ok: true } | { ok: false; error: string };

async function requireGovern(): Promise<{ employeeCode: string } | { error: string }> {
  const auth = await getAuthContext();
  if (!auth?.employeeCode) return { error: "ไม่พบสิทธิ์ผู้ใช้ กรุณาเข้าสู่ระบบใหม่" };
  const perms = new Set(auth.permissions);
  if (!(perms.has("masterdata.govern") || perms.has("roles.manage"))) {
    return { error: "ไม่มีสิทธิ์แก้เกณฑ์ Rank" };
  }
  return { employeeCode: auth.employeeCode };
}

/**
 * Save the whole ladder in one call.
 *
 * Sent as a set, like setZoneSales: the editor reorders ranks and adds/removes criteria
 * freely, and replaying that as individual row operations would need a diff on the client —
 * which is exactly the thing that is not allowed to be the source of truth.
 */
export async function saveSalesRanks(ranks: SalesRank[]): Promise<Result> {
  const auth = await requireGovern();
  if ("error" in auth) return { ok: false, error: auth.error };

  for (const r of ranks) {
    if (!r.name.trim()) return { ok: false, error: "ทุก Rank ต้องมีชื่อ" };
    for (const c of r.criteria) {
      if (!c.activityType) return { ok: false, error: `Rank ${r.name}: ยังไม่ได้เลือกกิจกรรม` };
      if (!Number.isFinite(c.target) || c.target < 1) {
        return { ok: false, error: `Rank ${r.name}: เป้าหมายต้องมากกว่า 0` };
      }
    }
  }

  const supabase = await createClient();
  const keepRanks = ranks.map((r) => r.id);

  // Criteria cascade from their rank, so deleting removed ranks first also clears theirs.
  const { data: existing } = await supabase.from("probation_rank").select("id");
  const gone = ((existing ?? []) as { id: string }[])
    .map((r) => r.id)
    .filter((id) => !keepRanks.includes(id));
  if (gone.length) {
    const { error } = await supabase.from("probation_rank").delete().in("id", gone);
    if (error) return { ok: false, error: error.message };
  }

  const { error: upRanks } = await supabase.from("probation_rank").upsert(
    ranks.map((r, i) => ({ id: r.id, name: r.name.trim(), sort_order: i + 1 })),
    { onConflict: "id" }
  );
  if (upRanks) return { ok: false, error: upRanks.message };

  // Replace each surviving rank's criteria wholesale — cheaper to reason about than a diff,
  // and the sets are single digits.
  if (keepRanks.length) {
    const { error } = await supabase.from("rank_criterion").delete().in("rank_id", keepRanks);
    if (error) return { ok: false, error: error.message };
  }
  const rows = ranks.flatMap((r, ri) =>
    r.criteria.map((c, ci) => ({
      id: c.id,
      rank_id: r.id,
      activity_type: c.activityType,
      target: Math.round(c.target),
      count_window: c.window,
      sort_order: ci + 1,
    }))
  );
  if (rows.length) {
    const { error } = await supabase.from("rank_criterion").insert(rows);
    if (error) return { ok: false, error: error.message };
  }

  await supabase.from("audit_log").insert({
    entity: "probation_rank",
    entity_id: "ladder",
    action: "save",
    changed_by: auth.employeeCode,
    before: {},
    after: { ranks: ranks.map((r) => ({ id: r.id, name: r.name, criteria: r.criteria.length })) },
  });

  revalidatePath("/settings");
  revalidatePath("/new-sales");
  return { ok: true };
}

/**
 * Put someone into the probation programme, or take them out by marking them passed.
 *
 * Gated on `people.manage` rather than `masterdata.govern` — this is a fact about a person,
 * and it writes `main_1_hr`, whose UPDATE policy asks for exactly that.
 */
export async function setProbation(
  code: string,
  probationStart: string | null,
  probationPassedAt: string | null
): Promise<Result> {
  const auth = await getAuthContext();
  if (!auth?.employeeCode) return { ok: false, error: "ไม่พบสิทธิ์ผู้ใช้ กรุณาเข้าสู่ระบบใหม่" };
  const perms = new Set(auth.permissions);
  if (!(perms.has("people.manage") || perms.has("roles.manage"))) {
    return { ok: false, error: "ไม่มีสิทธิ์แก้ข้อมูลโปรเบชั่น" };
  }
  if (probationPassedAt && !probationStart) {
    return { ok: false, error: "ต้องมีวันเข้าโปรแกรมก่อนถึงจะบันทึกว่าผ่านได้" };
  }
  if (probationStart && probationPassedAt && probationPassedAt < probationStart) {
    return { ok: false, error: "วันที่ผ่านต้องไม่ก่อนวันเข้าโปรแกรม" };
  }

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("main_1_hr")
    .select("probation_start,probation_passed_at")
    .eq("employee_code", code)
    .maybeSingle();
  if (!current) return { ok: false, error: "ไม่พบพนักงานคนนี้" };

  const { error } = await supabase
    .from("main_1_hr")
    .update({ probation_start: probationStart, probation_passed_at: probationPassedAt })
    .eq("employee_code", code);
  if (error) return { ok: false, error: error.message };

  await supabase.from("audit_log").insert({
    entity: "main_1_hr",
    entity_id: code,
    action: "set_probation",
    changed_by: auth.employeeCode,
    before: current,
    after: { probation_start: probationStart, probation_passed_at: probationPassedAt },
  });

  revalidatePath("/new-sales");
  revalidatePath("/team");
  revalidatePath(`/team/${code}`);
  return { ok: true };
}
