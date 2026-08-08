import { createClient } from "@/lib/supabase/server";

// The account-management surface (Settings → บัญชีผู้ใช้) — independent of `lib/team.ts`,
// which is still seed data (Phase 6). Reads `main_1_hr` directly, the same way
// `getMyListings()` reads the real listing table instead of a seed.

export interface AccountRow {
  employeeCode: string;
  nickname: string | null;
  email: string | null;
  status: string | null;
  /** Whether `auth_user_id` is set — the only thing the client needs to know; the raw id
   *  itself never leaves the server (see lib/mutations/accounts.ts). */
  hasAccount: boolean;
}

export async function getAccounts(): Promise<AccountRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("main_1_hr")
    .select("employee_code,nickname,email,status,auth_user_id")
    .order("employee_code");

  return (data ?? []).map((r) => ({
    employeeCode: r.employee_code,
    nickname: r.nickname,
    email: r.email,
    status: r.status,
    hasAccount: r.auth_user_id != null,
  }));
}
