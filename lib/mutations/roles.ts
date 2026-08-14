"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";

// ตั้งค่า → บทบาท & สิทธิ์. Writes `roles`, `role_permissions` and `user_roles`.
//
// This screen edited React state, which was the most dangerous of the in-memory settings:
// granting someone a permission LOOKED like it worked, the sidebar even changed for the
// "view as" persona, and nothing reached the database. Someone could believe they had given
// HR access and be wrong.
//
// ⚠️ TWO LOCKOUT GUARDS, and the second one was found the hard way.
//
//  1. COMPANY-WIDE. Every policy in the app has `has_perm('roles.manage')` as its escape
//     hatch. If the last holder loses it, nobody can grant it back — not through the app
//     and not through the API. So each write that could remove the last holder counts what
//     would remain and refuses to reach zero. RLS cannot express this: it sees one row.
//
//  2. YOURSELF. The first guard is about the company, and it happily let the signed-in
//     admin strip their OWN roles.manage while another holder existed — which is exactly
//     what happened in testing: the settings section is gated on that permission, so the
//     screen vanished mid-edit and the only way back was another admin or raw SQL.
//     Removing it from yourself is now refused separately, with the reason.
//     (Both are app-layer: RLS gates the write on has_perm, but has no notion of "after".)

type Result = { ok: true } | { ok: false; error: string };

async function requireRoleManage(): Promise<{ employeeCode: string } | { error: string }> {
  const auth = await getAuthContext();
  if (!auth?.employeeCode) return { error: "ไม่พบสิทธิ์ผู้ใช้ กรุณาเข้าสู่ระบบใหม่" };
  if (!auth.permissions.includes("roles.manage")) {
    return { error: "ไม่มีสิทธิ์จัดการบทบาทและสิทธิ์" };
  }
  return { employeeCode: auth.employeeCode };
}

function done() {
  // Permissions decide what every page renders, so this is not a /settings-only change.
  revalidatePath("/", "layout");
}

/**
 * Does `employeeCode` still hold `roles.manage` given a proposed change?
 *
 * Separate from the company-wide count because the two failures are different: losing the
 * last holder bricks the system, losing your own locks YOU out of the screen you are
 * standing on — and the second is far easier to do by accident.
 */
async function stillManages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  employeeCode: string,
  change: { roleId: string; keepsRoleManage: boolean } | { removeRole: string }
): Promise<boolean> {
  const [{ data: grants }, { data: mine }] = await Promise.all([
    supabase.from("role_permissions").select("role_id").eq("permission_key", "roles.manage"),
    supabase.from("user_roles").select("role_id").eq("employee_code", employeeCode),
  ]);
  const managerRoles = new Set(((grants ?? []) as { role_id: string }[]).map((g) => g.role_id));
  let myRoles = ((mine ?? []) as { role_id: string }[]).map((r) => r.role_id);

  if ("keepsRoleManage" in change) {
    if (change.keepsRoleManage) managerRoles.add(change.roleId);
    else managerRoles.delete(change.roleId);
  } else {
    myRoles = myRoles.filter((r) => r !== change.removeRole);
  }
  return myRoles.some((r) => managerRoles.has(r));
}

const SELF_LOCKOUT =
  "ทำไม่ได้ — คุณจะเสียสิทธิ์จัดการบทบาทของตัวเอง แล้วเข้าหน้านี้ไม่ได้อีก (ต้องให้แอดมินคนอื่นแก้คืน)";

/** How many people would still hold `roles.manage` after the proposed change. */
async function managersAfter(
  supabase: Awaited<ReturnType<typeof createClient>>,
  change: { roleId: string; keepsRoleManage: boolean } | { employeeCode: string; roleIds: string[] }
): Promise<number> {
  const [{ data: grants }, { data: assignments }] = await Promise.all([
    supabase.from("role_permissions").select("role_id").eq("permission_key", "roles.manage"),
    supabase.from("user_roles").select("employee_code,role_id"),
  ]);

  const managerRoles = new Set(((grants ?? []) as { role_id: string }[]).map((g) => g.role_id));
  const rows = ((assignments ?? []) as { employee_code: string; role_id: string }[]).slice();

  if ("keepsRoleManage" in change) {
    if (change.keepsRoleManage) managerRoles.add(change.roleId);
    else managerRoles.delete(change.roleId);
  } else {
    // Replace this person's assignments with the proposed set.
    const kept = rows.filter((r) => r.employee_code !== change.employeeCode);
    rows.length = 0;
    rows.push(...kept, ...change.roleIds.map((role_id) => ({ employee_code: change.employeeCode, role_id })));
  }

  const holders = new Set(
    rows.filter((r) => managerRoles.has(r.role_id)).map((r) => r.employee_code)
  );
  return holders.size;
}

export async function createRole(name: string): Promise<Result> {
  const auth = await requireRoleManage();
  if ("error" in auth) return { ok: false, error: auth.error };
  const label = name.trim();
  if (!label) return { ok: false, error: "ต้องใส่ชื่อบทบาท" };

  const supabase = await createClient();
  // The id is what user_roles and role_permissions store, so it is generated once and never
  // derived from the name — renaming a role must not orphan its grants.
  const id = `role_${Date.now().toString(36)}`;
  const { data: last } = await supabase
    .from("roles")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("roles").insert({
    id,
    name: label,
    description: "",
    is_system: false,
    sort_order: (last?.sort_order ?? 0) + 1,
  });
  if (error) return { ok: false, error: error.message };

  await supabase.from("audit_log").insert({
    entity: "roles",
    entity_id: id,
    action: "create",
    changed_by: auth.employeeCode,
    before: {},
    after: { name: label },
  });
  done();
  return { ok: true };
}

export async function renameRole(id: string, name: string): Promise<Result> {
  const auth = await requireRoleManage();
  if ("error" in auth) return { ok: false, error: auth.error };
  const label = name.trim();
  if (!label) return { ok: false, error: "ต้องใส่ชื่อบทบาท" };

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("roles")
    .select("name,is_system")
    .eq("id", id)
    .maybeSingle();
  if (!current) return { ok: false, error: "ไม่พบบทบาทนี้" };
  if (current.is_system) return { ok: false, error: "บทบาทของระบบเปลี่ยนชื่อไม่ได้" };

  const { error } = await supabase.from("roles").update({ name: label }).eq("id", id);
  if (error) return { ok: false, error: error.message };

  await supabase.from("audit_log").insert({
    entity: "roles",
    entity_id: id,
    action: "rename",
    changed_by: auth.employeeCode,
    before: { name: current.name },
    after: { name: label },
  });
  done();
  return { ok: true };
}

export async function deleteRole(id: string): Promise<Result> {
  const auth = await requireRoleManage();
  if ("error" in auth) return { ok: false, error: auth.error };

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("roles")
    .select("name,is_system")
    .eq("id", id)
    .maybeSingle();
  if (!current) return { ok: false, error: "ไม่พบบทบาทนี้" };
  if (current.is_system) return { ok: false, error: "บทบาทของระบบลบไม่ได้" };

  if ((await managersAfter(supabase, { roleId: id, keepsRoleManage: false })) === 0) {
    return {
      ok: false,
      error: "ลบไม่ได้ — จะไม่เหลือใครมีสิทธิ์จัดการบทบาท (ระบบจะแก้สิทธิ์ต่อไม่ได้เลย)",
    };
  }
  if (!(await stillManages(supabase, auth.employeeCode, { removeRole: id }))) {
    return { ok: false, error: SELF_LOCKOUT };
  }

  // Removing the people first makes the loss explicit in the audit trail rather than
  // happening silently through a cascade.
  const { count } = await supabase
    .from("user_roles")
    .select("employee_code", { count: "exact", head: true })
    .eq("role_id", id);
  await supabase.from("user_roles").delete().eq("role_id", id);
  await supabase.from("role_permissions").delete().eq("role_id", id);
  const { error } = await supabase.from("roles").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  await supabase.from("audit_log").insert({
    entity: "roles",
    entity_id: id,
    action: "delete",
    changed_by: auth.employeeCode,
    before: { name: current.name, users_removed: count ?? 0 },
    after: {},
  });
  done();
  return { ok: true };
}

/** Turn one permission on or off for a role. */
export async function setRolePermission(
  roleId: string,
  permissionKey: string,
  granted: boolean
): Promise<Result> {
  const auth = await requireRoleManage();
  if ("error" in auth) return { ok: false, error: auth.error };

  const supabase = await createClient();
  const { data: role } = await supabase
    .from("roles")
    .select("name,is_system")
    .eq("id", roleId)
    .maybeSingle();
  if (!role) return { ok: false, error: "ไม่พบบทบาทนี้" };
  if (role.is_system) return { ok: false, error: "บทบาทของระบบแก้สิทธิ์ไม่ได้" };

  if (permissionKey === "roles.manage" && !granted) {
    if ((await managersAfter(supabase, { roleId, keepsRoleManage: false })) === 0) {
      return {
        ok: false,
        error: "ปิดไม่ได้ — จะไม่เหลือใครมีสิทธิ์จัดการบทบาท (ระบบจะแก้สิทธิ์ต่อไม่ได้เลย)",
      };
    }
    if (!(await stillManages(supabase, auth.employeeCode, { roleId, keepsRoleManage: false }))) {
      return { ok: false, error: SELF_LOCKOUT };
    }
  }

  const { error } = granted
    ? await supabase
        .from("role_permissions")
        .upsert({ role_id: roleId, permission_key: permissionKey }, { onConflict: "role_id,permission_key" })
    : await supabase
        .from("role_permissions")
        .delete()
        .eq("role_id", roleId)
        .eq("permission_key", permissionKey);
  if (error) return { ok: false, error: error.message };

  await supabase.from("audit_log").insert({
    entity: "role_permissions",
    entity_id: `${roleId}/${permissionKey}`,
    action: granted ? "grant" : "revoke",
    changed_by: auth.employeeCode,
    before: {},
    after: { role: role.name, permission: permissionKey, granted },
  });
  done();
  return { ok: true };
}

/** Add or remove one role for one employee. */
export async function setUserRole(
  employeeCode: string,
  roleId: string,
  assigned: boolean
): Promise<Result> {
  const auth = await requireRoleManage();
  if ("error" in auth) return { ok: false, error: auth.error };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("user_roles")
    .select("role_id")
    .eq("employee_code", employeeCode);
  const current = ((existing ?? []) as { role_id: string }[]).map((r) => r.role_id);
  const next = assigned
    ? [...new Set([...current, roleId])]
    : current.filter((r) => r !== roleId);

  if ((await managersAfter(supabase, { employeeCode, roleIds: next })) === 0) {
    return {
      ok: false,
      error: "ถอดไม่ได้ — จะไม่เหลือใครมีสิทธิ์จัดการบทบาท (ระบบจะแก้สิทธิ์ต่อไม่ได้เลย)",
    };
  }
  // Taking a role off YOURSELF can strip your own roles.manage while the company still has
  // another admin — the company-wide count above says yes and you still lose the screen.
  if (
    !assigned &&
    employeeCode === auth.employeeCode &&
    !(await stillManages(supabase, employeeCode, { removeRole: roleId }))
  ) {
    return { ok: false, error: SELF_LOCKOUT };
  }

  const { error } = assigned
    ? await supabase
        .from("user_roles")
        .upsert({ employee_code: employeeCode, role_id: roleId }, { onConflict: "employee_code,role_id" })
    : await supabase
        .from("user_roles")
        .delete()
        .eq("employee_code", employeeCode)
        .eq("role_id", roleId);
  if (error) return { ok: false, error: error.message };

  await supabase.from("audit_log").insert({
    entity: "user_roles",
    entity_id: `${employeeCode}/${roleId}`,
    action: assigned ? "assign" : "unassign",
    changed_by: auth.employeeCode,
    before: { roles: current },
    after: { roles: next },
  });
  done();
  return { ok: true };
}
