import { createClient } from "@/lib/supabase/server";

// Server-side identity: who is signed in, which employee row they are, and what they may do.
//
// The join is the whole point of the auth bridge added to the DB on 2026-08-03:
//     auth.users.id → main_1_hr.auth_user_id → employee_code → user_roles → role_permissions
// Every RLS policy filters on the same chain via `current_employee_code()` / `has_perm()`,
// so what the UI hides and what the database refuses stay in agreement.
export interface AuthContext {
  userId: string;
  email: string | null;
  /** null when the account exists in auth but no employee row links to it yet. */
  employeeCode: string | null;
  nickname: string | null;
  teamId: string | null;
  /** Union of every permission across the roles this employee holds. */
  permissions: string[];
}

/** The signed-in user, or null when there is no session. */
export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = await createClient();

  // getUser() revalidates the token with Supabase — getSession() only decodes the cookie,
  // which a client could have forged. Never gate access on getSession().
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const base: AuthContext = {
    userId: user.id,
    email: user.email ?? null,
    employeeCode: null,
    nickname: null,
    teamId: null,
    permissions: [],
  };

  const { data: employee } = await supabase
    .from("main_1_hr")
    .select("employee_code, nickname, team_id, status")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  // Signed in but not linked to an employee (or the employee was terminated) → no
  // permissions. Deliberately not an error: the account is valid, it just grants nothing.
  if (!employee || employee.status === "Terminate") return base;

  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("role_id")
    .eq("employee_code", employee.employee_code);

  const roleIds = (roleRows ?? []).map((r) => r.role_id);
  let permissions: string[] = [];

  if (roleIds.length) {
    const { data: permRows } = await supabase
      .from("role_permissions")
      .select("permission_key")
      .in("role_id", roleIds);
    permissions = [...new Set((permRows ?? []).map((p) => p.permission_key))];
  }

  return {
    ...base,
    employeeCode: employee.employee_code,
    nickname: employee.nickname,
    teamId: employee.team_id,
    permissions,
  };
}
