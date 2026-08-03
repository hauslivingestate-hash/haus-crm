// SAMPLE DATA — the people/HR surface. Schema mirrors the source **HR Sheet →
// "Employee Lists"** tab (cols A–AE). Wire later = an `employees` table joined to
// user_roles (login = Employee.id ↔ rbac OrgUser.id). Effort is derived live from the
// activity log. See DATA_MODEL.md → "HR Sheet".
//
// Field sensitivity (enforced in the UI + wiring-phase RLS):
//   • normal        — anyone who can see the team surface
//   • financials    — salary + commission rate      → gate `financials.view_comp`
//   • pii/legal     — ID card, bank, payslip, docs   → gate `people.view_sensitive`

import { listActivities, type Activity } from "@/lib/actions";
import { listZones } from "@/lib/zones";

export type EmployeeStatus = "active" | "terminated";
/** Functional group, from the sheet's "2nd Position" (Sales/Support) + C-Level. */
export type Department = "management" | "sales" | "support";
export type Gender = "male" | "female";

export interface Employee {
  /** Login id — mirrors rbac OrgUser.id for staff who have an account. */
  id: string;
  /** Employee Code (PK) — C-xxx C-level · S-xxx Sales · SP-xxx Support. */
  code: string;
  status: EmployeeStatus;

  // Role / placement
  division?: string; // "C-Level" (mostly empty in source)
  position: string; // job title: CEO / Sales / Listing Support / Marketing
  department: Department; // derived grouping (2nd Position)
  /** Zone codes owned (Sales). Inverse of Zone.sale_id_assigned; many for a player-coach. */
  zoneCodes: string[];

  // Identity
  firstNameEn?: string;
  lastNameEn?: string;
  firstNameTh?: string;
  lastNameTh?: string;
  /** Nickname — the identity string used across the app (activities, contacts, targets). */
  nickname: string;
  /** Profile image URL. HAUS-authored (NOT in the HR Sheet) — wire to a storage bucket. */
  avatarUrl?: string;
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
  startDate?: string; // YYYY-MM-DD
  /** New-sales probation program entry (HAUS-authored, not in the HR Sheet). Present =
   *  "เซลล์ใหม่" — rank derives from the activity log (lib/probation). Cleared on pass. */
  probationStart?: string; // YYYY-MM-DD

  // Emergency
  emergencyContact?: string;
  emergencyPhone?: string;
  emergencyRelation?: string;

  remark?: string;
  /** Per-agent listing sheet(s) — source col U "Sheet ID (Sales)". */
  salesSheetUrl?: string;

  // --- sensitive: financials.view_comp ---
  salary?: number; // ฿ / month
  commissionRate?: number; // fraction, e.g. 0.6 = 60% split (NOT a baht amount)

  // --- sensitive: people.view_sensitive (PII / legal docs) ---
  idCardNo?: string;
  bankAccount?: string; // KBANK
  payslipDriveUrl?: string;
  agreementFilesUrl?: string;
}

// Real staff from the HR Sheet (nicknames + codes are real; PII/financials are
// placeholder sample values, not the real sheet data).
const EMPLOYEES: Employee[] = [
  {
    id: "u_stone",
    code: "C-001",
    status: "active",
    division: "C-Level",
    position: "CEO",
    department: "management",
    zoneCodes: ["BGY", "RP1"],
    firstNameEn: "Chantat",
    lastNameEn: "Raoprachong",
    firstNameTh: "ฉันทัช",
    lastNameTh: "เราประจง",
    nickname: "Stone",
    gender: "male",
    nationality: "Thai",
    phone: "095-269-8599",
    email: "stonelismz@gmail.com",
    workEmail: "stonelismz@gmail.com",
    startDate: "2024-01-15",
    commissionRate: 0.6,
    salary: 0,
    bankAccount: "028-1-19670-7",
    idCardNo: "1-1037-01360-06-2",
  },
  {
    id: "u_pup",
    code: "S-001",
    status: "active",
    position: "Sales",
    department: "sales",
    zoneCodes: ["BGY", "SLY"],
    firstNameEn: "Waratchadamanee",
    lastNameEn: "Prapaisin",
    firstNameTh: "วรัฎชฎามณี",
    lastNameTh: "ประไพศิลป์",
    nickname: "Pup",
    gender: "female",
    nationality: "Thai",
    phone: "095-453-6446",
    email: "waratchadamanee.p@gmail.com",
    workEmail: "waratchadamanee.p@gmail.com",
    startDate: "2024-03-01",
    commissionRate: 0.6,
  },
  {
    id: "u_game",
    code: "S-002",
    status: "active",
    position: "Sales",
    department: "sales",
    zoneCodes: ["RM2", "PKS"],
    firstNameEn: "Thanaphat",
    lastNameEn: "Plengpiw",
    firstNameTh: "ธนพัฒน์",
    lastNameTh: "เปล่งผิว",
    nickname: "Game",
    gender: "male",
    nationality: "Thai",
    phone: "064-465-1545",
    email: "thanapat.plengpiw@gmail.com",
    workEmail: "thanapat.plengpiw@gmail.com",
    startDate: "2024-06-01",
    commissionRate: 0.6,
  },
  {
    id: "u_q",
    code: "S-003",
    status: "active",
    position: "Sales",
    department: "sales",
    zoneCodes: ["CYP", "RP1"],
    firstNameEn: "Veenat",
    lastNameEn: "Haanpongsachana",
    firstNameTh: "วีร์ณัชญ์",
    lastNameTh: "ห่านพงศาชนะ",
    nickname: "Q",
    gender: "male",
    nationality: "Thai",
    phone: "099-793-6641",
    email: "veenathaanpongsachana@gmail.com",
    workEmail: "veenathaanpongsachana@gmail.com",
    birthday: "1992-08-20",
    startDate: "2024-06-15",
    commissionRate: 0.6,
  },
  {
    id: "u_mhow",
    code: "S-004",
    status: "active",
    position: "Sales",
    department: "sales",
    zoneCodes: ["ASK", "BWK"],
    firstNameTh: "ปภัสย์กร",
    lastNameTh: "อัครนิธิพิรกุล",
    nickname: "Mhow",
    gender: "male",
    nationality: "Thai",
    phone: "093-251-9466",
    email: "phapaskorn@gmail.com",
    workEmail: "phapaskorn@gmail.com",
    startDate: "2025-01-06",
    probationStart: "2026-05-01", // new-sales program entry (sample)
    commissionRate: 0.5,
  },
  {
    id: "u_golf",
    code: "S-005",
    status: "active",
    position: "Sales",
    department: "sales",
    zoneCodes: [],
    firstNameTh: "กฤษฏิ์",
    lastNameTh: "ภควัตเมธี",
    nickname: "Golf",
    gender: "male",
    nationality: "Thai",
    phone: "081-909-4966",
    email: "golfk.ph@gmail.com",
    startDate: "2025-03-01",
    probationStart: "2026-06-15", // new-sales program entry (sample)
    commissionRate: 0.5,
  },
  {
    id: "u_benz",
    code: "SP-001",
    status: "active",
    position: "Listing Support",
    department: "support",
    zoneCodes: [],
    firstNameTh: "ทินภัทร",
    lastNameTh: "เตชะเชี่ยวณรงค์",
    nickname: "Benz",
    gender: "male",
    nationality: "Thai",
    phone: "091-444-9565",
    email: "yukioh5ds@gmail.com",
    startDate: "2024-09-01",
    commissionRate: 0.006,
  },
  {
    id: "u_pui",
    code: "SP-002",
    status: "active",
    position: "Marketing",
    department: "support",
    zoneCodes: [],
    firstNameTh: "ทิพย์สกาญจน์",
    lastNameTh: "สังข์สวน",
    nickname: "Pui",
    gender: "female",
    nationality: "Thai",
    phone: "094-926-2651",
    email: "pouis.puii@gmail.com",
    startDate: "2024-11-01",
    commissionRate: 0.006,
  },
  // Terminated — no login (no rbac OrgUser); kept for records/history.
  {
    id: "e_nut",
    code: "",
    status: "terminated",
    position: "Sales",
    department: "sales",
    zoneCodes: [],
    nickname: "Nut",
    gender: "male",
    nationality: "Thai",
  },
  {
    id: "e_pai",
    code: "SP-003",
    status: "terminated",
    position: "Support",
    department: "support",
    zoneCodes: [],
    firstNameTh: "ศตายุ",
    lastNameTh: "ฉายะเวชสกุณ",
    nickname: "Pai",
    gender: "male",
    nationality: "Thai",
    phone: "082-864-8446",
    salary: 26000,
  },
];

export const DEPARTMENT_LABEL: Record<Department, string> = {
  management: "ผู้บริหาร",
  sales: "ฝ่ายขาย",
  support: "ฝ่ายสนับสนุน",
};

export function listEmployees(): Employee[] {
  return EMPLOYEES;
}

/** Sales staff eligible for lead assignment (active + in the sales department). */
export function listSalesAgents(): Employee[] {
  return EMPLOYEES.filter((e) => e.status === "active" && e.department === "sales");
}

/** New sales still in the probation program (the เซลล์ใหม่ board's population). */
export function listNewSales(): Employee[] {
  return listSalesAgents().filter((e) => !!e.probationStart);
}

export function getEmployee(id: string): Employee | undefined {
  return EMPLOYEES.find((e) => e.id === id);
}

/** Full display name (Thai preferred, else English, else nickname). */
export function employeeFullName(e: Employee): string {
  const th = [e.firstNameTh, e.lastNameTh].filter(Boolean).join(" ").trim();
  if (th) return th;
  const en = [e.firstNameEn, e.lastNameEn].filter(Boolean).join(" ").trim();
  return en || e.nickname;
}

/** Zone names (Thai) owned by an employee, resolved against the zone master. */
export function employeeZoneNames(e: Employee): string[] {
  const zones = listZones();
  return e.zoneCodes
    .map((code) => zones.find((z) => z.zone_id === code)?.name_thai)
    .filter((n): n is string => !!n);
}

/** Activity count this month for an employee — the "effort" figure, from the log.
 *  `activities` = the LIVE log (ActivityProvider); defaults to the static sample for
 *  non-React callers. Pass the live array so ticking a Daily-Plan task moves this number —
 *  ทีม is one of the surfaces people review activity on. */
export function effortThisMonth(
  nickname: string,
  month = "2026-07",
  activities: Activity[] = listActivities()
): number {
  return activities
    .filter((a) => a.created_by === nickname && a.date.startsWith(month))
    .reduce((sum, a) => sum + a.count, 0);
}
