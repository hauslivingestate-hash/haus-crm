"use client";

import * as React from "react";
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, KeyRound, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { resetUserPassword, createUserAccount } from "@/lib/mutations/accounts";
import type { AccountRow } from "@/lib/accounts";
import { cn } from "@/lib/cn";

const MIN_LENGTH = 8;

// Settings → บัญชีผู้ใช้ (gated to `people.manage_accounts`). One row per employee_code —
// an existing login gets "ตั้งรหัสผ่านใหม่", no login yet gets "สร้างบัญชี". Same
// busy/error/done shape as AccountSettings.tsx and ListingEditSheet.tsx.
export function AccountsManager({ accounts }: { accounts: AccountRow[] }) {
  const [openFor, setOpenFor] = React.useState<string | null>(null);

  return (
    <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
      {accounts.map((a) => (
        <div key={a.employeeCode} className="bg-surface">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="text-body font-medium truncate">
                {a.nickname ?? a.employeeCode}
                <span className="num text-label text-text-subtle ml-2">{a.employeeCode}</span>
              </div>
              <div className="text-small text-text-muted truncate">{a.email ?? "— ไม่มีอีเมล —"}</div>
            </div>
            {a.status && a.status !== "Active" && (
              <span className="text-label text-text-subtle border border-border rounded-md px-2 py-0.5 shrink-0">
                {a.status}
              </span>
            )}
            <button
              type="button"
              onClick={() => setOpenFor((cur) => (cur === a.employeeCode ? null : a.employeeCode))}
              className="h-8 px-3 rounded-md border border-border-strong text-small font-medium text-text-muted hover:bg-surface-2 transition-colors inline-flex items-center gap-1.5 shrink-0"
            >
              {a.hasAccount ? (
                <>
                  <KeyRound size={13} strokeWidth={1.75} /> ตั้งรหัสผ่านใหม่
                </>
              ) : (
                <>
                  <UserPlus size={13} strokeWidth={1.75} /> สร้างบัญชี
                </>
              )}
            </button>
          </div>
          {openFor === a.employeeCode && (
            <div className="px-4 pb-4 border-t border-border pt-3">
              {a.hasAccount ? (
                <ResetPasswordForm employeeCode={a.employeeCode} onDone={() => setOpenFor(null)} />
              ) : (
                <CreateAccountForm
                  employeeCode={a.employeeCode}
                  initialEmail={a.email ?? ""}
                  onDone={() => setOpenFor(null)}
                />
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const field =
  "w-full h-9 px-3 rounded-md border border-border-strong bg-surface text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

function ResetPasswordForm({ employeeCode, onDone }: { employeeCode: string; onDone: () => void }) {
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  const canSubmit = next.length >= MIN_LENGTH && next === confirm && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    const result = await resetUserPassword(employeeCode, next);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDone(true);
    setTimeout(onDone, 1200);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 max-w-sm">
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
        <span className="text-label text-text-subtle">อย่างน้อย {MIN_LENGTH} ตัวอักษร</span>
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
        {confirm.length > 0 && next !== confirm && (
          <span className="text-label text-red">รหัสผ่านไม่ตรงกัน</span>
        )}
      </label>
      <StatusRow error={error} done={done} doneLabel="ตั้งรหัสผ่านใหม่แล้ว" />
      <button
        type="submit"
        disabled={!canSubmit}
        className="h-9 rounded-md bg-accent text-text-onaccent font-medium hover:bg-accent-hover transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
      >
        {busy && <Loader2 size={14} strokeWidth={2} className="animate-spin" />}
        {busy ? "กำลังบันทึก…" : "ตั้งรหัสผ่านใหม่"}
      </button>
    </form>
  );
}

function CreateAccountForm({
  employeeCode,
  initialEmail,
  onDone,
}: {
  employeeCode: string;
  initialEmail: string;
  onDone: () => void;
}) {
  const [email, setEmail] = React.useState(initialEmail);
  const [password, setPassword] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  const canSubmit = email.includes("@") && password.length >= MIN_LENGTH && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    const result = await createUserAccount(employeeCode, email, password);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDone(true);
    setTimeout(onDone, 1200);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 max-w-sm">
      <label className="flex flex-col gap-1.5">
        <span className="text-small text-text-muted">อีเมล (ใช้ login)</span>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-9"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-small text-text-muted">รหัสผ่านเริ่มต้น</span>
        <div className="relative">
          <input
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
        <span className="text-label text-text-subtle">อย่างน้อย {MIN_LENGTH} ตัวอักษร — บอกพนักงานให้เปลี่ยนเองที่ /account หลัง login ครั้งแรก</span>
      </label>
      <StatusRow error={error} done={done} doneLabel="สร้างบัญชีแล้ว" />
      <button
        type="submit"
        disabled={!canSubmit}
        className="h-9 rounded-md bg-accent text-text-onaccent font-medium hover:bg-accent-hover transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
      >
        {busy && <Loader2 size={14} strokeWidth={2} className="animate-spin" />}
        {busy ? "กำลังสร้าง…" : "สร้างบัญชี"}
      </button>
    </form>
  );
}

function StatusRow({ error, done, doneLabel }: { error: string | null; done: boolean; doneLabel: string }) {
  if (error) {
    return (
      <div className="rounded-md px-3 py-2 text-small border bg-red-bg text-red border-red/30 flex items-start gap-1.5">
        <AlertCircle size={14} strokeWidth={2} className="mt-0.5 shrink-0" />
        {error}
      </div>
    );
  }
  if (done) {
    return (
      <div className="rounded-md px-3 py-2 text-small border bg-green-bg text-green border-green/30 flex items-start gap-1.5">
        <CheckCircle2 size={14} strokeWidth={2} className="mt-0.5 shrink-0" />
        {doneLabel}
      </div>
    );
  }
  return null;
}
