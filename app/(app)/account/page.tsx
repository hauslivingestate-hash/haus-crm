import { redirect } from "next/navigation";
import { Topbar } from "@/components/Topbar";
import { AccountSettings } from "@/components/AccountSettings";
import { getAuthContext } from "@/lib/auth";
import { AUTH_ENFORCED } from "@/lib/supabaseConfig";

// The signed-in user's own account — the only place a password can be changed, since
// accounts ship with an admin-set one.
//
// Gated to `people.manage_accounts` (Ben, 2026-08-08) — the same 3 roles (CEO/HR/
// system_admin) that manage everyone else's login now own self-service too; everyone
// else asks one of them to reset a forgotten password via Settings → บัญชีผู้ใช้. Sign-out
// stays reachable for everyone regardless — it's a standalone control in Sidebar.tsx, not
// routed through this page.
//
// Dynamic because it reads the session. With auth off there is nobody to show, so it
// bounces to /login rather than rendering an empty shell.
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const auth = AUTH_ENFORCED ? await getAuthContext() : null;
  if (!auth) redirect("/login");
  if (!auth.permissions.includes("people.manage_accounts")) redirect("/");

  return (
    <>
      <Topbar title="บัญชีของฉัน" subtitle="อีเมลและรหัสผ่านสำหรับเข้าสู่ระบบ" actions={false} />
      <AccountSettings
        email={auth.email ?? ""}
        nickname={auth.nickname ?? auth.email ?? "ผู้ใช้"}
      />
    </>
  );
}
