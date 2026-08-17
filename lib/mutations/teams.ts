"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";

// ตั้งค่า → ทีมขาย. Writes `teams` and `main_1_hr.team_id`.
//
// This is the mechanism the CEO will use to name team leads. Ben, 2026-08-15: build it so
// it CAN be set, but do not set anything — the CEO does that.
//
// ⚠️ Why it matters beyond a label: `visible_employee_codes()` resolves "team" scope from
// `main_1_hr.team_id`, and with `teams` empty it returns just the caller for EVERYONE,
// including the CEO. That is why the activity column on /team reads "—" for colleagues,
// why nobody can set a target for someone else, and why a team dashboard is impossible
// today. Naming one team with one leader turns all three on.
//
// A leader also needs the `sales_leader` ROLE to hold the team-scoped permissions — that is
// a separate grant on ตั้งค่า → บทบาท & สิทธิ์, and the editor says so rather than granting
// it silently: membership and authority are different decisions.

type Result = { ok: true } | { ok: false; error: string };

async function requireTeamManage(): Promise<{ employeeCode: string } | { error: string }> {
  const auth = await getAuthContext();
  if (!auth?.employeeCode) return { error: "ไม่พบสิทธิ์ผู้ใช้ กรุณาเข้าสู่ระบบใหม่" };
  const perms = new Set(auth.permissions);
  if (!(perms.has("teams.manage") || perms.has("roles.manage"))) {
    return { error: "ไม่มีสิทธิ์จัดการทีม" };
  }
  return { employeeCode: auth.employeeCode };
}

function done() {
  // Team membership changes what rows people can see, so this is not a /settings-only edit.
  revalidatePath("/", "layout");
}

export async function createTeam(name: string): Promise<Result> {
  const auth = await requireTeamManage();
  if ("error" in auth) return { ok: false, error: auth.error };
  const label = name.trim();
  if (!label) return { ok: false, error: "ต้องใส่ชื่อทีม" };

  const supabase = await createClient();
  // Generated, not derived from the name: `main_1_hr.team_id` stores it, so a rename must
  // not orphan the members.
  const id = `team_${Date.now().toString(36)}`;
  const { data: last } = await supabase
    .from("teams")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase
    .from("teams")
    .insert({ id, name: label, sort_order: (last?.sort_order ?? 0) + 1 });
  if (error) return { ok: false, error: error.message };

  await supabase.from("audit_log").insert({
    entity: "teams",
    entity_id: id,
    action: "create",
    changed_by: auth.employeeCode,
    before: {},
    after: { name: label },
  });
  done();
  return { ok: true };
}

export async function updateTeam(
  id: string,
  patch: { name?: string; revenueGoal?: number | null }
): Promise<Result> {
  const auth = await requireTeamManage();
  if ("error" in auth) return { ok: false, error: auth.error };

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("teams")
    .select("name,revenue_goal")
    .eq("id", id)
    .maybeSingle();
  if (!current) return { ok: false, error: "ไม่พบทีมนี้" };

  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    const label = patch.name.trim();
    if (!label) return { ok: false, error: "ต้องใส่ชื่อทีม" };
    update.name = label;
  }
  if (patch.revenueGoal !== undefined) {
    if (patch.revenueGoal != null && (!Number.isFinite(patch.revenueGoal) || patch.revenueGoal < 0)) {
      return { ok: false, error: "เป้ารายได้ต้องไม่ติดลบ" };
    }
    update.revenue_goal = patch.revenueGoal;
  }
  if (!Object.keys(update).length) return { ok: true };

  const { error } = await supabase.from("teams").update(update).eq("id", id);
  if (error) return { ok: false, error: error.message };

  await supabase.from("audit_log").insert({
    entity: "teams",
    entity_id: id,
    action: "update",
    changed_by: auth.employeeCode,
    before: current,
    after: update,
  });
  done();
  return { ok: true };
}

export async function deleteTeam(id: string): Promise<Result> {
  const auth = await requireTeamManage();
  if ("error" in auth) return { ok: false, error: auth.error };

  const supabase = await createClient();
  const { data: current } = await supabase.from("teams").select("name").eq("id", id).maybeSingle();
  if (!current) return { ok: false, error: "ไม่พบทีมนี้" };

  const { count } = await supabase
    .from("main_1_hr")
    .select("employee_code", { count: "exact", head: true })
    .eq("team_id", id);

  // Release the members first: main_1_hr.team_id has no cascade, and leaving them pointing
  // at a deleted team would break the scope helper rather than merely emptying it.
  await supabase.from("main_1_hr").update({ team_id: null }).eq("team_id", id);
  const { error } = await supabase.from("teams").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  await supabase.from("audit_log").insert({
    entity: "teams",
    entity_id: id,
    action: "delete",
    changed_by: auth.employeeCode,
    before: { name: current.name, members_released: count ?? 0 },
    after: {},
  });
  done();
  return { ok: true };
}

/** Put someone in a team, or take them out (`teamId = null`). One team per person. */
export async function setEmployeeTeam(
  employeeCode: string,
  teamId: string | null
): Promise<Result> {
  const auth = await requireTeamManage();
  if ("error" in auth) return { ok: false, error: auth.error };

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("main_1_hr")
    .select("team_id")
    .eq("employee_code", employeeCode)
    .maybeSingle();
  if (!current) return { ok: false, error: "ไม่พบพนักงานคนนี้" };

  const { error } = await supabase
    .from("main_1_hr")
    .update({ team_id: teamId })
    .eq("employee_code", employeeCode);
  if (error) return { ok: false, error: error.message };

  // Someone removed from the team they led cannot go on leading it.
  if (!teamId && current.team_id) {
    await supabase
      .from("teams")
      .update({ leader_code: null })
      .eq("id", current.team_id)
      .eq("leader_code", employeeCode);
  }

  await supabase.from("audit_log").insert({
    entity: "main_1_hr",
    entity_id: employeeCode,
    action: "set_team",
    changed_by: auth.employeeCode,
    before: { team_id: current.team_id },
    after: { team_id: teamId },
  });
  done();
  return { ok: true };
}

/** Name the team's lead. Passing null clears it. */
export async function setTeamLeader(teamId: string, employeeCode: string | null): Promise<Result> {
  const auth = await requireTeamManage();
  if ("error" in auth) return { ok: false, error: auth.error };

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("teams")
    .select("leader_code")
    .eq("id", teamId)
    .maybeSingle();
  if (!current) return { ok: false, error: "ไม่พบทีมนี้" };

  if (employeeCode) {
    // A leader must be in the team — `visible_employee_codes()` reads membership, so a
    // leader outside it would see nobody and the setting would look broken.
    const { data: emp } = await supabase
      .from("main_1_hr")
      .select("team_id")
      .eq("employee_code", employeeCode)
      .maybeSingle();
    if (!emp) return { ok: false, error: "ไม่พบพนักงานคนนี้" };
    if (emp.team_id !== teamId) {
      return { ok: false, error: "ต้องเพิ่มเข้าทีมก่อน ถึงจะตั้งเป็นหัวหน้าได้" };
    }
  }

  const { error } = await supabase
    .from("teams")
    .update({ leader_code: employeeCode })
    .eq("id", teamId);
  if (error) return { ok: false, error: error.message };

  await supabase.from("audit_log").insert({
    entity: "teams",
    entity_id: teamId,
    action: "set_leader",
    changed_by: auth.employeeCode,
    before: { leader_code: current.leader_code },
    after: { leader_code: employeeCode },
  });
  done();
  return { ok: true };
}
