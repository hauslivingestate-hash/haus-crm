import { redirect } from "next/navigation";
import { Topbar } from "@/components/Topbar";
import { AccountSettings } from "@/components/AccountSettings";
import { getAuthContext } from "@/lib/auth";
import { AUTH_ENFORCED } from "@/lib/supabaseConfig";

// The signed-in user's own account — the only place a password can be changed, since
// accounts ship with an admin-set one.
//
// No permission gate: every account owns itself. Reached from the sidebar user menu, not
// from the nav (lib/nav.ts is company surfaces; this is personal).
//
// Dynamic because it reads the session. With auth off there is nobody to show, so it
// bounces to /login rather than rendering an empty shell.
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const auth = AUTH_ENFORCED ? await getAuthContext() : null;
  if (!auth) redirect("/login");

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
