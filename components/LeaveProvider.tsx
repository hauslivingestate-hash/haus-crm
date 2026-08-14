"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_LEAVE_ALLOWANCES,
  type LeaveRequest,
  type LeaveStatus,
  type LeaveAllowance,
} from "@/lib/leave";
import {
  submitLeave as submitLeaveAction,
  decideLeave as decideLeaveAction,
  withdrawLeave as withdrawLeaveAction,
  type LeaveDraft,
} from "@/lib/mutations/leave";

// Shared leave state for the two surfaces that need it:
//   • แผนวันนี้ — a rep files ขอลา and sees the "you're on leave" banner
//   • /leave    — HR reviews the queue and approves or rejects
//
// Phase 6 replaced the in-memory store with the `leave_requests` table. The rows arrive
// from the layout (server-rendered, RLS-scoped) and every mutation is a server action
// followed by router.refresh(); the provider itself no longer holds the truth, it just
// hands the shared list down and reports busy/error state.
//
// The approve/reject gate is enforced in the action AND in RLS, not here — the UI only
// decides whether to draw the buttons.

interface Ctx {
  requests: LeaveRequest[];
  allowances: LeaveAllowance[];
  /** File a new request — always lands as `pending`. */
  submit: (draft: LeaveDraft) => Promise<boolean>;
  decide: (id: number, status: Exclude<LeaveStatus, "pending">) => Promise<boolean>;
  /** Cancel a request you filed — only possible while still pending. */
  withdraw: (id: number) => Promise<boolean>;
  requestsFor: (employeeCode: string | null) => LeaveRequest[];
  pendingCount: number;
  busy: boolean;
  error: string | null;
  clearError: () => void;
}

const Ctx = React.createContext<Ctx | null>(null);

export function LeaveProvider({
  children,
  requests = [],
  allowances = DEFAULT_LEAVE_ALLOWANCES,
}: {
  children: React.ReactNode;
  requests?: LeaveRequest[];
  allowances?: LeaveAllowance[];
}) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Busy until the refreshed rows land, not just until the write returns — the same gap
  // that let /today's tick act on a stale render.
  const [refreshing, startRefresh] = React.useTransition();

  const run = React.useCallback(
    async (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
      setSaving(true);
      setError(null);
      try {
        const res = await fn();
        if (!res.ok) {
          setError(res.error);
          return false;
        }
        startRefresh(() => router.refresh());
        return true;
      } catch (e) {
        // A server action can reject outright; swallowing it would leave the queue looking
        // unchanged with no explanation.
        setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [router]
  );

  const submit = React.useCallback((draft: LeaveDraft) => run(() => submitLeaveAction(draft)), [run]);
  const decide = React.useCallback(
    (id: number, status: Exclude<LeaveStatus, "pending">) => run(() => decideLeaveAction(id, status)),
    [run]
  );
  const withdraw = React.useCallback((id: number) => run(() => withdrawLeaveAction(id)), [run]);

  const requestsFor = React.useCallback(
    (employeeCode: string | null) =>
      employeeCode
        ? requests
            .filter((r) => r.employeeId === employeeCode)
            .sort((a, b) => b.startDate.localeCompare(a.startDate))
        : [],
    [requests]
  );

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <Ctx.Provider
      value={{
        requests,
        allowances,
        submit,
        decide,
        withdraw,
        requestsFor,
        pendingCount,
        busy: saving || refreshing,
        error,
        clearError: () => setError(null),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useLeave(): Ctx {
  const c = React.useContext(Ctx);
  if (!c) throw new Error("useLeave must be used within LeaveProvider");
  return c;
}
