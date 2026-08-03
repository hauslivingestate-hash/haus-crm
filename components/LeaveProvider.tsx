"use client";

import * as React from "react";
import {
  listLeave,
  DEFAULT_LEAVE_ALLOWANCES,
  type LeaveRequest,
  type LeaveStatus,
  type LeaveAllowance,
} from "@/lib/leave";

// Shared LIVE store for leave requests (design-first, in-memory), seeded from the real
// HR Sheet rows. Two sides read it:
//   • แผนวันนี้ — a rep submits ขอลา and sees their own requests / away banner
//   • /leave    — HR reviews the queue and approves or rejects
// Both must see the same list the instant one changes, which is why it's a provider rather
// than page-local state.
//
// Wire later = `leave_requests` table; submit/decide become insert + update. Enforce the
// decision gate in RLS (`leave.manage`), not just in the UI.

interface Ctx {
  requests: LeaveRequest[];
  /** File a new request — always lands as `pending`. */
  submit: (r: Omit<LeaveRequest, "id" | "status">) => void;
  /** Approve or reject. `by` is the decider's nickname (audit trail). */
  decide: (id: string, status: Exclude<LeaveStatus, "pending">, by: string, at: string) => void;
  /** Cancel a request you filed — only meaningful while still pending. */
  withdraw: (id: string) => void;
  requestsFor: (employeeId: string) => LeaveRequest[];
  pendingCount: number;
  /** Annual quota per leave type. PLACEHOLDER values — CEO edits in ตั้งค่า → โควตาวันลา. */
  allowances: LeaveAllowance[];
  setAllowances: React.Dispatch<React.SetStateAction<LeaveAllowance[]>>;
}

const Ctx = React.createContext<Ctx | null>(null);

// Monotonic id source. `requests.length` is unsafe — withdraw() shrinks the array, so
// submit → withdraw → submit would mint an id that already exists, and decide()/withdraw()
// would then act on both rows. Wire = a DB-generated id.
let leaveSeq = 0;
const newLeaveId = () => `lv_new_${++leaveSeq}`;

export function LeaveProvider({ children }: { children: React.ReactNode }) {
  const [requests, setRequests] = React.useState<LeaveRequest[]>(() => listLeave());
  const [allowances, setAllowances] = React.useState<LeaveAllowance[]>(
    () => [...DEFAULT_LEAVE_ALLOWANCES]
  );

  const submit = React.useCallback((r: Omit<LeaveRequest, "id" | "status">) => {
    setRequests((xs) => [{ ...r, id: newLeaveId(), status: "pending" }, ...xs]);
  }, []);

  const decide = React.useCallback(
    (id: string, status: Exclude<LeaveStatus, "pending">, by: string, at: string) => {
      setRequests((xs) =>
        xs.map((r) => (r.id === id ? { ...r, status, decidedBy: by, decidedAt: at } : r))
      );
    },
    []
  );

  const withdraw = React.useCallback((id: string) => {
    setRequests((xs) => xs.filter((r) => r.id !== id));
  }, []);

  const requestsFor = React.useCallback(
    (employeeId: string) =>
      requests
        .filter((r) => r.employeeId === employeeId)
        .sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [requests]
  );

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <Ctx.Provider
      value={{ requests, submit, decide, withdraw, requestsFor, pendingCount, allowances, setAllowances }}
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
