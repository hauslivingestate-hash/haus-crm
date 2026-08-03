// Leave management (วันลา) — SAMPLE DATA + logic, design-first.
//
// Source: **HR Sheet → `Day off`** tab (cols A–G). Real columns:
//   A Date Submit · B Name · C Start Date · D End Date · E Condition (leave type) ·
//   F Remark · G ลิงค์กรอก (Google Form link — empty in every row)
//
// ⚠️ The source has **NO approval column** — today it is a pure submission log. The CRM
// ADDS an approval step (Ben, 2026-08-01): requests land as `pending` and HR/CEO decides.
// That is a deliberate process change, not a port. `decidedBy`/`decidedAt` have no source
// column and start empty for historical rows.
//
// Seed below is the REAL sheet content (21 rows), dates converted from DD/MM/YYYY.
// Wire later = `leave_requests(id, employee_id, submitted_at, start_date, end_date, type,
// remark, status, decided_by, decided_at)`.

import { TODAY } from "@/lib/momentum";

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
  id: string;
  /** Employee/OrgUser id — ids mirror across rbac + team (lib/team.ts). */
  employeeId: string;
  /** Denormalized for display; source stores only the nickname. */
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

// Real rows from the HR Sheet. Statuses are ASSIGNED here (no source column): everything
// up to early July reads as settled → approved; the most recent three are left pending so
// the HR queue has something to act on.
const SAMPLE: LeaveRequest[] = [
  { id: "lv_01", employeeId: "u_benz", nickname: "Benz", submittedAt: "2026-04-03", startDate: "2026-05-03", endDate: "2026-05-04", type: "ลาพักร้อน", remark: "EIEI", status: "approved" },
  { id: "lv_02", employeeId: "u_pui", nickname: "Pui", submittedAt: "2026-04-09", startDate: "2026-04-15", endDate: "2026-04-20", type: "ลาพักร้อน", remark: "ไปพัทลุงจ้า", status: "approved" },
  { id: "lv_03", employeeId: "u_q", nickname: "Q", submittedAt: "2026-04-09", startDate: "2026-04-16", endDate: "2026-04-20", type: "ลาพักร้อน", remark: "กลับใต้", status: "approved" },
  { id: "lv_04", employeeId: "u_golf", nickname: "Golf", submittedAt: "2026-04-10", startDate: "2026-05-30", endDate: "2026-06-03", type: "ลาพักร้อน", remark: "เกาะเต่า", status: "approved" },
  { id: "lv_05", employeeId: "u_pup", nickname: "Pup", submittedAt: "2026-04-10", startDate: "2026-04-16", endDate: "2026-04-18", type: "ลาพักร้อน", remark: null, status: "approved" },
  { id: "lv_06", employeeId: "u_game", nickname: "Game", submittedAt: "2026-04-27", startDate: "2026-05-02", endDate: "2026-05-06", type: "ลากิจ", remark: "กลับใต้", status: "approved" },
  { id: "lv_07", employeeId: "u_stone", nickname: "Stone", submittedAt: "2026-05-05", startDate: "2026-05-13", endDate: "2026-05-15", type: "ลาพักร้อน", remark: null, status: "approved" },
  { id: "lv_08", employeeId: "u_stone", nickname: "Stone", submittedAt: "2026-05-22", startDate: "2026-05-29", endDate: "2026-05-29", type: "ลาพักร้อน", remark: "ไปเวียดนาม", status: "approved" },
  { id: "lv_09", employeeId: "u_mhow", nickname: "Mhow", submittedAt: "2026-05-25", startDate: "2026-06-05", endDate: "2026-06-05", type: "ลาพักร้อน", remark: "ไป ตจว ครับบ", status: "approved" },
  { id: "lv_10", employeeId: "u_pup", nickname: "Pup", submittedAt: "2026-05-25", startDate: "2026-05-28", endDate: "2026-05-29", type: "ลาพักร้อน", remark: null, status: "approved" },
  { id: "lv_11", employeeId: "u_pui", nickname: "Pui", submittedAt: "2026-05-25", startDate: "2026-05-29", endDate: "2026-05-29", type: "ลาพักร้อน", remark: null, status: "approved" },
  { id: "lv_12", employeeId: "u_q", nickname: "Q", submittedAt: "2026-05-29", startDate: "2026-05-29", endDate: "2026-05-31", type: "ลาพักร้อน", remark: null, status: "approved" },
  { id: "lv_13", employeeId: "u_pui", nickname: "Pui", submittedAt: "2026-06-23", startDate: "2026-06-23", endDate: "2026-06-23", type: "ลาป่วย", remark: "Mental Health JubJub eiei", status: "approved" },
  // ⚠️ SOURCE DATA ERROR: sheet row 15 reads start 09/10/2026, end 20/06/2026 — end BEFORE
  // start. Remark is "ไปเที่ยวเมกา". Seeded as 9–20 Oct (assuming the end month was mistyped).
  // Confirm with HR at import; add a start<=end constraint so this can't recur.
  { id: "lv_14", employeeId: "u_golf", nickname: "Golf", submittedAt: "2026-06-25", startDate: "2026-10-09", endDate: "2026-10-20", type: "ลาพักร้อน", remark: "ไปเที่ยวเมกา", status: "approved" },
  { id: "lv_15", employeeId: "u_benz", nickname: "Benz", submittedAt: "2026-07-07", startDate: "2026-07-08", endDate: "2026-07-08", type: "ลากิจ", remark: "จัดการเรื่องห้องเช่า", status: "approved" },
  { id: "lv_16", employeeId: "u_benz", nickname: "Benz", submittedAt: "2026-07-07", startDate: "2026-07-16", endDate: "2026-07-17", type: "ลาพักร้อน", remark: "เขาใหญ่", status: "approved" },
  { id: "lv_17", employeeId: "u_pup", nickname: "Pup", submittedAt: "2026-07-07", startDate: "2026-07-10", endDate: "2026-07-14", type: "ลาพักร้อน", remark: null, status: "approved" },
  // Awaiting a decision — gives the HR queue something to act on.
  { id: "lv_18", employeeId: "u_game", nickname: "Game", submittedAt: "2026-07-31", startDate: "2026-07-31", endDate: "2026-08-02", type: "ลากิจ", remark: "ปาลินไม่สบาย", status: "pending" },
  { id: "lv_19", employeeId: "u_stone", nickname: "Stone", submittedAt: "2026-07-31", startDate: "2026-08-14", endDate: "2026-08-14", type: "ลาพักร้อน", remark: "ไปพัทยา", status: "pending" },
  // Sheet rows 21 and 22 are IDENTICAL duplicates — deduped here to one. Import must
  // dedupe on (employee, start, end, type) or the same leave counts twice.
  { id: "lv_20", employeeId: "u_golf", nickname: "Golf", submittedAt: "2026-07-31", startDate: "2026-08-14", endDate: "2026-08-14", type: "ลาเพื่อทำหมัน", remark: null, status: "pending" },
];

export function listLeave(): LeaveRequest[] {
  return [...SAMPLE];
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
export function awayOn(requests: LeaveRequest[], iso: string = TODAY): LeaveRequest[] {
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
  year: string = TODAY.slice(0, 4)
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
  year: string = TODAY.slice(0, 4)
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
  year: string = TODAY.slice(0, 4)
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
