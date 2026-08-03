import type { Metadata } from "next";
import { LoginForm } from "@/components/LoginForm";

// Wired to Supabase Auth (2026-08-03). `middleware.ts` sends signed-out visitors here and
// bounces signed-in ones away.
//
// This route deliberately sits OUTSIDE the app shell: it renders its own full-screen layout
// with no Sidebar/Topbar, because a signed-out visitor must not see the nav (which today
// leaks the whole surface map). `app/login/layout.tsx` overrides the root chrome.
//
// force-dynamic because the form reads `?next=` via useSearchParams — prerendering it would
// need a Suspense boundary and flash a fallback over the whole screen. A login page has
// nothing worth caching anyway.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "เข้าสู่ระบบ — HAUS CRM",
};

export default function LoginPage() {
  return <LoginForm />;
}
