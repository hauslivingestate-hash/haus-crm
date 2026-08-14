// Leave management (วันลา) — types and pure helpers.
//
// Originally from HR Sheet → `Day off`. Phase 6 replaced the seed with the real
// `leave_requests` / `leave_allowances` tables (read in lib/queries.ts, written in
// lib/mutations/leave.ts). The helpers stay here because LeaveBoard is a client component.
//
// ⚠️ The source sheet had **NO approval column** — it was a pure submission log. The CRM
// ADDS an approval step (Ben, 2026-08-01): requests land as `pending` and HR/CEO decides.
// That is a deliberate process change, not a port, so the 20 imported rows carry no
// decidedBy/decidedAt.

import { todayISO } from "@/lib/momentum";

export type LeaveStatus = "pending" | "approved" | "rejected";

export const LEAVE_STATUS_LABEL: Record<LeaveStatus, string> = {
  pending: "รออนุมัติ",
  approved: "อนุมัติแล้ว",
  rejected: "ไม่อนุมัติ",
};

export const LEAVE_STATUS_TONE: Record<LeaveStatus, "amber" | "green" | "red"> = {
  pending: "amber",
  approved: "green",
  rejected: "red",
};

// Types observed in the source, plus the statutory ones the team will eventually need.
// `ลาเพื่อทำหมัน` is a real Thai statutory leave and DOES appear in the sheet — keep it.
// Free-text in the source (note the trailing space on "ลาป่วย "); normalize on import.
export const LEAVE_TYPES = [
  "ลาพักร้อน",
  "ลากิจ",
  "ลาป่วย",
  "ลาคลอด",
  "ลาเพื่อทำหมัน",
  "อื่นๆ",
];

export interface LeaveRequest {
  id: number;
  /** `main_1_hr.employee_code` (S-002) — the DB key, not a seed user id. */
  employeeId: string;
  /** Resolved for display; the row itself stores only the code. */
  nickname: string;
  submittedAt: string; // ISO date
  startDate: string; // ISO date, inclusive
  endDate: string; // ISO date, inclusive
  type: string;
  remark: string | null;
  status: LeaveStatus;
  decidedBy?: string;
  decidedAt?: string;
}

/** Inclusive day count — 1 day off is 1, not 0. */
export function leaveDays(r: Pick<LeaveRequest, "startDate" | "endDate">): number {
  const a = new Date(r.startDate + "T00:00:00Z").getTime();
  const b = new Date(r.endDate + "T00:00:00Z").getTime();
  if (isNaN(a) || isNaN(b) || b < a) return 0;
  return Math.round((b - a) / 86_400_000) + 1;
}

/** Does this request cover the given ISO date? Only approved/pending count as "away". */
export function coversDate(r: LeaveRequest, iso: string): boolean {
  return r.status !== "rejected" && iso >= r.startDate && iso <= r.endDate;
}

/** Everyone away on a given date — powers the Daily-Plan banner and the HR day view. */
export function awayOn(requests: LeaveRequest[], iso: string = todayISO()): LeaveRequest[] {
  return requests.filter((r) => coversDate(r, iso));
}

/**
 * Days of a request that fall INSIDE the given calendar year.
 *
 * Leave spanning New Year (e.g. 30 Dec → 3 Jan) must be split across both years' quotas.
 * Filtering on `startDate` alone charged all 5 days to the start year and none to the next,
 * which is wrong for the employee's balance AND for HR's over-quota list.
 */
export function leaveDaysInYear(
  r: Pick<LeaveRequest, "startDate" | "endDate">,
  year: string
): number {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const from = r.startDate > yearStart ? r.startDate : yearStart;
  const to = r.endDate < yearEnd ? r.endDate : yearEnd;
  if (to < from) return 0; // request doesn't touch this year at all
  return leaveDays({ startDate: from, endDate: to });
}

/** Approved days taken in a calendar year — the balance figure HR cares about.
 *  Counts only the portion that falls within `year` (see leaveDaysInYear). */
export function daysTakenInYear(
  requests: LeaveRequest[],
  employeeId: string,
  year: string = todayISO().slice(0, 4)
): number {
  return requests
    .filter((r) => r.employeeId === employeeId && r.status === "approved")
    .reduce((sum, r) => sum + leaveDaysInYear(r, year), 0);
}

// ── Allowance / quota ────────────────────────────────────────────────────────────────
//
// ⚠️ THE SOURCE SHEET HAS NO ALLOWANCE DATA. The numbers below are **placeholders** — Thai
// statutory MINIMUMS, not this company's actual policy. The CEO edits them in
// ตั้งค่า → โควตาวันลา. Treat every figure here as "needs confirming with HR", and note
// employment law changes: verify against current law at wiring, don't trust these.
//
// Modelled PER TYPE, deliberately. ลาพักร้อน / ลาป่วย / ลากิจ have different statutory
// limits, and ลาคลอด / ลาเพื่อทำหมัน don't come from an annual pool at all — a single
// pooled "days remaining" figure would be wrong for every one of them.
//
// Known gap: the allowance is COMPANY-WIDE. Real policies usually scale with seniority, and
// year-one staff are often pro-rated. Wire = `leave_allowances(type, days_per_year)` plus an
// optional per-employee override, and ask HR about carry-over before adding any of it.

export interface LeaveAllowance {
  type: string;
  /** Days per calendar year. `null` = not drawn from an annual pool (maternity,
   *  sterilisation) — tracked but never counted against a quota. */
  daysPerYear: number | null;
  /** Shown under the number so nobody mistakes a placeholder for policy. */
  note?: string;
}

export const DEFAULT_LEAVE_ALLOWANCES: LeaveAllowance[] = [
  { type: "ลาพักร้อน", daysPerYear: 6, note: "ขั้นต่ำตามกฎหมาย — ยืนยันกับ HR" },
  { type: "ลากิจ", daysPerYear: 3, note: "ขั้นต่ำตามกฎหมาย — ยืนยันกับ HR" },
  { type: "ลาป่วย", daysPerYear: 30, note: "สูงสุดที่ได้รับค่าจ้าง" },
  { type: "ลาคลอด", daysPerYear: null, note: "ตามกฎหมาย ไม่นับโควตาปี" },
  { type: "ลาเพื่อทำหมัน", daysPerYear: null, note: "ตามที่แพทย์กำหนด" },
  { type: "อื่นๆ", daysPerYear: null, note: "ไม่นับโควตา" },
];

export interface TypeUsage {
  type: string;
  used: number;
  /** null = untracked type (no annual pool). */
  allowance: number | null;
  /** Days left; null when untracked. Can go negative — that's the point. */
  remaining: number | null;
  over: boolean;
}

/** Per-type usage for one employee in a year. Counts APPROVED leave only —
 *  a pending request hasn't been granted, so it must not consume quota. */
export function usageByType(
  requests: LeaveRequest[],
  allowances: LeaveAllowance[],
  employeeId: string,
  year: string = todayISO().slice(0, 4)
): TypeUsage[] {
  const mine = requests.filter((r) => r.employeeId === employeeId && r.status === "approved");
  return allowances.map((a) => {
    // Year-boundary aware: a request spanning New Year charges each year its own portion.
    const used = mine
      .filter((r) => r.type === a.type)
      .reduce((sum, r) => sum + leaveDaysInYear(r, year), 0);
    const remaining = a.daysPerYear == null ? null : a.daysPerYear - used;
    return {
      type: a.type,
      used,
      allowance: a.daysPerYear,
      remaining,
      over: remaining != null && remaining < 0,
    };
  });
}

/** Everyone currently over quota on at least one type — the HR warning list. */
export function overQuota(
  requests: LeaveRequest[],
  allowances: LeaveAllowance[],
  year: string = todayISO().slice(0, 4)
): { employeeId: string; nickname: string; rows: TypeUsage[] }[] {
  const byEmployee = new Map<string, string>();
  for (const r of requests) byEmployee.set(r.employeeId, r.nickname);
  const out: { employeeId: string; nickname: string; rows: TypeUsage[] }[] = [];
  for (const [employeeId, nickname] of byEmployee) {
    const rows = usageByType(requests, allowances, employeeId, year).filter((u) => u.over);
    if (rows.length) out.push({ employeeId, nickname, rows });
  }
  return out.sort((a, b) => a.nickname.localeCompare(b.nickname));
}
