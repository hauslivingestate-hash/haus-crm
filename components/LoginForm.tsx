"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, AlertCircle, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { supabaseBrowser } from "@/lib/supabase/client";
import { AUTH_ENFORCED } from "@/lib/supabaseConfig";

// Real sign-in against Supabase Auth (wired 2026-08-03).
//
// The error copy stays generic ("อีเมลหรือรหัสผ่านไม่ถูกต้อง") on purpose — distinguishing
// "no such account" from "wrong password" hands out a user-enumeration oracle.
//
// Accounts are issued by the company (personal email as the login; an admin sets the
// password), so there is no sign-up path and no self-service reset here.
//
// ⚠️ There are no accounts yet — `auth.users` is empty until the HR sheet is imported. Until
// then AUTH_ENFORCED is off: sign-in works if you have an account, but nothing forces one,
// and the seeded "view as" demo keeps running. See lib/supabaseConfig.ts.

const field =
  "w-full h-10 px-3 rounded-md border border-border-strong bg-surface text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setBusy(true);

    const { error: authError } = await supabaseBrowser().auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      setBusy(false);
      setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      return;
    }

    // Only accept a same-site path from ?next — an absolute URL here would be an open
    // redirect (attacker sends /login?next=https://evil.example and we bounce the user there
    // right after they type their password).
    const next = searchParams.get("next");
    const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

    // refresh() so server components re-render with the new session cookie; without it the
    // shell would still be rendered for a signed-out visitor.
    router.replace(target);
    router.refresh();
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-[1fr_1.1fr]">
      {/* Form column */}
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
        <div className="w-full max-w-sm mx-auto">
          {/* Brand — same treatment as the sidebar rail */}
          <div className="leading-none mb-8">
            <div
              className="text-h1 font-bold tracking-tight"
              style={{ color: "var(--maroon-900)" }}
            >
              HAUS
            </div>
            <div className="text-label uppercase text-text-subtle mt-0.5">Living Estate</div>
          </div>

          <h1 className="text-h2">เข้าสู่ระบบ</h1>
          <p className="text-small text-text-muted mt-1">
            ใช้บัญชีพนักงานที่บริษัทออกให้
          </p>

          <form onSubmit={submit} className="mt-6 flex flex-col gap-3.5">
            <label className="flex flex-col gap-1.5">
              <span className="text-small text-text-muted">อีเมล</span>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@hausliving.co.th"
                autoComplete="email"
                autoFocus
                className="h-10"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-small text-text-muted">รหัสผ่าน</span>
              <div className="relative">
                <input
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className={cn(field, "pr-10")}
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 size-7 grid place-items-center rounded-md text-text-subtle hover:bg-surface-hover hover:text-text transition-colors"
                >
                  {show ? <EyeOff size={15} strokeWidth={1.75} /> : <Eye size={15} strokeWidth={1.75} />}
                </button>
              </div>
            </label>

            {error && (
              <div className="rounded-md px-3 py-2 text-small border bg-red-bg text-red border-red/30 inline-flex items-center gap-1.5">
                <AlertCircle size={14} strokeWidth={2} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="h-10 rounded-md bg-accent text-text-onaccent font-medium hover:bg-accent-hover transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
            >
              {busy && <Loader2 size={15} strokeWidth={2} className="animate-spin" />}
              {busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
            </button>

            {/* No self-service reset: accounts are issued by the company, and there is no
                mail provider wired. Point at the admin instead of shipping a dead link. */}
            <p className="text-label text-text-subtle text-center">
              ลืมรหัสผ่าน? ติดต่อแอดมินเพื่อรีเซ็ต
            </p>
          </form>

          {/* Shown only while the kill-switch is off, i.e. before any account exists. */}
          {!AUTH_ENFORCED && (
            <div className="mt-8 rounded-md border border-border bg-surface-2 px-3 py-2.5 flex items-start gap-2">
              <ShieldCheck
                size={14}
                strokeWidth={1.75}
                className="text-text-subtle mt-0.5 shrink-0"
              />
              <p className="text-label text-text-subtle">
                <span className="text-text-muted font-medium">โหมดเดโม</span> —
                ต่อระบบยืนยันตัวตนแล้ว แต่ยังไม่ได้สร้างบัญชีพนักงาน (รอ import ข้อมูล HR)
                ระหว่างนี้ยังเข้าใช้งานได้โดยไม่ต้องล็อกอิน
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Brand column — hidden on mobile, where it would just push the form off-screen */}
      <div className="hidden lg:flex relative overflow-hidden border-l border-border bg-surface-2">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 90% at 85% 15%, var(--crimson-12) 0%, transparent 55%), radial-gradient(90% 80% at 10% 90%, var(--bronze-12) 0%, transparent 60%)",
          }}
        />
        <div className="relative flex flex-col justify-end p-14">
          <p className="text-h1 leading-tight max-w-md">
            ระบบจัดการงานขายอสังหาฯ<br />ของ Haus Living Estate
          </p>
          <p className="text-body text-text-muted mt-3 max-w-md">
            ทรัพย์ · ลูกค้า · แผนงานประจำวัน · ผลงานทีม — รวมไว้ที่เดียว
          </p>
        </div>
      </div>
    </div>
  );
}
