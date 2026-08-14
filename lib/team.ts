// People / HR — types and pure helpers.
//
// Phase 6 replaced the seeded roster with `main_1_hr` (read in lib/queries.ts). The seed
// carried made-up salaries, ID-card numbers and bank accounts for real, named colleagues;
// it is gone rather than deprecated.
//
// Field sensitivity — enforced by GRANT, not just by the UI:
//   • normal     — anyone signed in (main_1_hr SELECT policy is `using (true)`)
//   • financials — salary, commission        → `financials.view_comp`, read via
//   • pii/legal  — ID card, bank, payslip…   → `people.view_sensitive`   v_employee_private
// `select` on those columns is REVOKED from `authenticated` on the base table, so they can
// only arrive through v_employee_private, which nulls them per-permission.

export type EmployeeStatus = "active" | "terminated";
/** Functional group, derived from the sheet's "2nd Position" (Sales/Support) + C-Level. */
export type Department = "management" | "sales" | "support";
export type Gender = "male" | "female";

export interface Employee {
  /** `main_1_hr.employee_code` (PK, and the route key) — C-xxx C-level · S-xxx Sales ·
   *  SP-xxx Support. There is no separate login id: permissions run on this. */
  code: string;
  status: EmployeeStatus;

  // Role / placement
  division?: string;
  /** Job title. NULL for 6 of 10 in the source sheet — show "—", don't invent one. */
  position: string;
  department: Department;
  /** Zone codes covered, from `zone_sales`. Many per person; a few are the personal
   *  catch-all zones the sheet created (all named "นอกโซน"). */
  zoneCodes: string[];
  /** Thai zone names, resolved server-side so the client needs no zone master. */
  zoneNames: string[];
  /** Role names from `user_roles` → `roles.name`. */
  roleNames: string[];
  /** From `main_1_hr.team_id` → `teams.name`. ⚠️ `teams` is EMPTY and nobody holds
   *  `sales_leader`: the CEO has not named team leads yet, so this is undefined for
   *  everyone and `visible_employee_codes()` resolves to "just me" for all roles. */
  teamName?: string;
  /** True when this person leads their team (`teams.leader_code`). */
  isTeamLeader?: boolean;

  // Identity
  firstNameEn?: string;
  lastNameEn?: string;
  firstNameTh?: string;
  lastNameTh?: string;
  /** Nickname — what the app shows everywhere. */
  nickname: string;
  gender?: Gender;
  nationality?: string;

  // Contact
  phone?: string;
  phoneAlt?: string;
  email?: string;
  workEmail?: string;
  lineUserId?: string;

  // Dates
  birthday?: string; // YYYY-MM-DD
  /** ⚠️ EMPTY for all 10 — the HR sheet never had it. The new-sales ladder and first-year
   *  leave pro-rating both need it, so neither can be computed until HR fills it in. */
  startDate?: string;
  /** Entry date into the เซลล์ใหม่ probation program. ⚠️ NOT A COLUMN — there is no
   *  probation table yet and `date_started` (which it would derive from) is empty for
   *  everyone, so this is always undefined and the ladder board is empty on purpose.
   *  Kept on the type so the board keeps compiling for when HR supplies the dates. */
  probationStart?: string;

  // Emergency
  emergencyContact?: string;
  emergencyPhone?: string;
  emergencyRelation?: string;

  remark?: string;
  salesSheetUrl?: string;

  /** Logged activity this month. `null` = the viewer isn't allowed to see this person's
   *  log, which is NOT the same as zero — see getEmployees(). */
  effortThisMonth: number | null;

  // --- via v_employee_private, null unless permitted ---
  salary?: number | null;
  /** Fraction, e.g. 0.6 = a 60% split — not a baht amount. */
  commissionRate?: number | null;
  idCardNo?: string | null;
  bankAccount?: string | null;
  payslipDriveUrl?: string | null;
  agreementFilesUrl?: string | null;
}

export const DEPARTMENT_LABEL: Record<Department, string> = {
  management: "ผู้บริหาร",
  sales: "ฝ่ายขาย",
  support: "ฝ่ายสนับสนุน",
};

/** The sheet stores 'Active' / 'Terminate'; anything unrecognised counts as gone. */
export function asEmployeeStatus(raw: string | null | undefined): EmployeeStatus {
  return (raw ?? "").toLowerCase().startsWith("active") ? "active" : "terminated";
}

/**
 * Department from the two title columns.
 *
 * `second_position` is the reliable one (Sales/Support, filled for 9 of 10). `position` is
 * the job title and is mostly null — but a C-level title outranks it: Stone is
 * second_position = Sales AND the CEO, and belongs under ผู้บริหาร.
 */
export function departmentOf(
  position: string | null | undefined,
  secondPosition: string | null | undefined
): Department {
  const p = (position ?? "").toUpperCase();
  if (p === "CEO" || p === "CTO" || p === "CFO") return "management";
  const s = (secondPosition ?? "").toLowerCase();
  if (s.startsWith("sales")) return "sales";
  if (s.startsWith("support")) return "support";
  return "support";
}

export function asGender(raw: string | null | undefined): Gender | undefined {
  const g = (raw ?? "").toLowerCase();
  if (g.startsWith("male") || g === "ชาย") return "male";
  if (g.startsWith("female") || g === "หญิง") return "female";
  return undefined;
}

/** Full display name (Thai preferred, else English, else the nickname). */
export function employeeFullName(e: {
  firstNameTh?: string;
  lastNameTh?: string;
  firstNameEn?: string;
  lastNameEn?: string;
  nickname: string;
}): string {
  const th = [e.firstNameTh, e.lastNameTh].filter(Boolean).join(" ").trim();
  if (th) return th;
  const en = [e.firstNameEn, e.lastNameEn].filter(Boolean).join(" ").trim();
  return en || e.nickname;
}
