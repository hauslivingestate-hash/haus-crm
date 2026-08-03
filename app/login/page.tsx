import type { Metadata } from "next";
import { LoginForm } from "@/components/LoginForm";

// DESIGN ONLY — no auth provider is wired. See DATA_MODEL.md → "HANDOVER — read this first".
//
// This route deliberately sits OUTSIDE the app shell: it renders its own full-screen layout
// with no Sidebar/Topbar, because a signed-out visitor must not see the nav (which today
// leaks the whole surface map). `app/login/layout.tsx` overrides the root chrome.
//
// Wiring notes for whoever picks this up:
//   • Auth is the #1 priority — every privacy feature in this app is decoration until it
//     exists (owner contact, Last Match scoping, contact scoping are all client-side filters).
//   • On success, replace `RbacProvider`'s "view as" switcher with the real session: the
//     signed-in user's id → OrgUser → union of role permissions → `can()`.
//   • Add middleware to redirect unauthenticated requests here, and send authenticated ones
//     away from /login.
//   • Employee login ids already mirror `rbac OrgUser.id` ↔ `Employee.id` (lib/team.ts), so
//     the join is `auth.users.id → employees.id → user_roles`.

export const metadata: Metadata = {
  title: "เข้าสู่ระบบ — HAUS CRM",
};

export default function LoginPage() {
  return <LoginForm />;
}
