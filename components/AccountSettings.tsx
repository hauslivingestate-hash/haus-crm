"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, LogOut, KeyRound } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";

// The signed-in user's own account. Deliberately NOT part of /settings: that hub is company
// master data gated by govern permissions, while this is personal and every user gets it.
//
// Accounts are issued with an admin-set password (Ben, 2026-08-03), so this screen is the
// only way a password ever changes. Without it the temporary passwords handed out at
// rollout would stay in use forever.
//
// The current password is re-checked before the change. Supabase doesn't require it by
// default, which means a walked-away-from desk is enough to lock the real owner out of
// their own account. The extra round-trip is worth that.

const MIN_LENGTH = 8;

export function AccountSettings({ email, nickname }: { email: string; nickname: string }) {
  const router = useRouter();
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  const tooShort = next.length > 0 && next.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && next !== confirm;
  const canSubmit =
    current.length > 0 && next.length >= MIN_LENGTH && next === confirm && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setDone(false);
    setBusy(true);

    const supabase = supabaseBrowser();

    // Re-authenticate first. Also catches the "I forgot which password I set" case before
    // we overwrite anything.
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: current,
    });
    if (signInError) {
      setBusy(false);
      setError("รหัสผ่านปัจจุบันไม่ถูกต้อง");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: next });
    setBusy(false);

    if (updateError) {
      // Supabase rejects a new password identical to the old one, among others. Surface its
      // own message rather than inventing a wrong reason.
      setError(updateError.message || "เปลี่ยนรหัสผ่านไม่สำเร็จ ลองใหม่อีกครั้ง");
      return;
    }

    setCurrent("");
    setNext("");
    setConfirm("");
    setDone(true);
  }

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const field =
    "w-full h-10 px-3 rounded-md border border-border-strong bg-surface text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

  return (
    <div className="p-4 sm:p-6 max-w-lg flex flex-col gap-5">
      {/* Who you are */}
      <section className="rounded-lg border border-border bg-surface p-4">
        <div className="text-label uppercase text-text-subtle mb-2">บัญชีที่ใช้อยู่</div>
        <div className="text-body text-text">{nickname}</div>
        <div className="text-small text-text-muted num">{email}</div>
        <p className="text-label text-text-subtle mt-3">
          อีเมลเปลี่ยนเองไม่ได้ — ติดต่อผู้ดูแลระบบ
        </p>
      </section>

      {/* Change password */}
      <section className="rounded-lg border border-border bg-surface p-4">
        <div className="flex items-center gap-1.5 mb-3">
          <KeyRound size={14} strokeWidth={1.75} className="text-text-subtle" />
          <h2 className="text-h3">เปลี่ยนรหัสผ่าน</h2>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3.5">
          <label className="flex flex-col gap-1.5">
            <span className="text-small text-text-muted">รหัสผ่านปัจจุบัน</span>
            <input
              type={show ? "text" : "password"}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              className={field}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-small text-text-muted">รหัสผ่านใหม่</span>
            <div className="relative">
              <input
                type={show ? "text" : "password"}
                value={next}
                onChange={(e) => setNext(e.target.value)}
                autoComplete="new-password"
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
            <span
              className={cn(
                "text-label",
                tooShort ? "text-red" : "text-text-subtle"
              )}
            >
              อย่างน้อย {MIN_LENGTH} ตัวอักษร
            </span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-small text-text-muted">ยืนยันรหัสผ่านใหม่</span>
            <input
              type={show ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              className={field}
            />
            {mismatch && <span className="text-label text-red">รหัสผ่านไม่ตรงกัน</span>}
          </label>

          {error && (
            <div className="rounded-md px-3 py-2 text-small border bg-red-bg text-red border-red/30 flex items-start gap-1.5">
              <AlertCircle size={14} strokeWidth={2} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {done && (
            <div className="rounded-md px-3 py-2 text-small border bg-green-bg text-green border-green/30 flex items-start gap-1.5">
              <CheckCircle2 size={14} strokeWidth={2} className="mt-0.5 shrink-0" />
              เปลี่ยนรหัสผ่านเรียบร้อย ครั้งต่อไปใช้รหัสใหม่
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="h-10 rounded-md bg-accent text-text-onaccent font-medium hover:bg-accent-hover transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
          >
            {busy && <Loader2 size={15} strokeWidth={2} className="animate-spin" />}
            {busy ? "กำลังบันทึก…" : "เปลี่ยนรหัสผ่าน"}
          </button>
        </form>
      </section>

      <button
        onClick={signOut}
        className="h-10 rounded-md border border-border-strong text-text hover:bg-surface-hover transition-colors inline-flex items-center justify-center gap-2"
      >
        <LogOut size={15} strokeWidth={1.75} />
        ออกจากระบบ
      </button>
    </div>
  );
}
