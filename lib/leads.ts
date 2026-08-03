// Lead intake model — the admin "receive from any channel → log → assign" flow.
// Ported from the Custom Dashboard LeadForm/CompanyLeads references, mapped onto the HAUS
// schema. Leads live in Supabase (main_6_buyer_crm) which the design build reads read-only,
// so NEW leads created here are OPTIMISTIC/local (NewLeadsProvider) — not persisted. The
// shape mirrors the eventual insert. See DATA_MODEL → "Lead intake & assignment".
//
// New vs main_6_buyer_crm: `source` (ช่องทาง) and the `requirements` block are NOT columns
// yet — add them at wiring (a `source` column + a `requirements` jsonb, or normalized cols).

import { listEmployees, type Employee } from "@/lib/team";

/** Stubbed intake date (design-stable). Swap for a real clock at wiring. */
export const INTAKE_TODAY = "2026-07-20";

// ── Marketing Channel (where the lead came from) — matches the real "Lead Submission" form's
//    Marketing Channel column. (The sheet also has a separate "Contact By" field — see docs.)
// NOTE: these lists are SEEDS — the live, editable copies live in MasterDataProvider
// (Settings ▸ ช่องทาง & ฟิลด์ Lead edits them; the intake form reads them). Hence the id
// types are plain strings, not unions: the vocabulary is data, not a compile-time enum.
export type LeadSource = string;
export const LEAD_SOURCES: { id: LeadSource; label: string }[] = [
  { id: "ddproperty", label: "DDproperty" },
  { id: "livinginsider", label: "Livinginsider" },
  { id: "facebook", label: "Facebook" },
  { id: "line", label: "LINE OA" },
  { id: "offline", label: "ป้าย / Offline" },
  { id: "website", label: "เว็บไซต์" },
  { id: "walkin", label: "Walk-in" },
  { id: "referral", label: "แนะนำต่อ" },
  { id: "other", label: "อื่นๆ" },
];
export function sourceLabel(id: string | null | undefined): string {
  return LEAD_SOURCES.find((s) => s.id === id)?.label ?? (id || "—");
}

// ── Contact By — the inbox/method the lead arrived through (separate from Marketing
//    Channel = where it came from). Matches the sheet's "Contact By" column. ────────
export type ContactBy = string; // seed ids below; live list in MasterDataProvider
export const CONTACT_BYS: { id: ContactBy; label: string }[] = [
  { id: "line_oa", label: "LINE OA" },
  { id: "call", label: "Call / โทร" },
  { id: "dd_inbox", label: "DDproperty Inbox" },
  { id: "fb_inbox", label: "Facebook Inbox" },
  { id: "walkin", label: "Walk-in" },
  { id: "other", label: "อื่นๆ" },
];
export function contactByLabel(id: string | null | undefined): string {
  return CONTACT_BYS.find((c) => c.id === id)?.label ?? (id || "—");
}

export const GENDERS = [
  { id: "male", label: "ชาย" },
  { id: "female", label: "หญิง" },
];
export const NATIONALITIES = ["ไทย", "ต่างชาติ"];

// ── buyer vs owner — one axis that swaps labels + the requirements block ──────
export type LeadRole = "buyer" | "owner";

// ── controlled vocabularies (single source of truth; also fed to the AI schema) ──
export const LEAD_POTENTIALS = ["A", "B", "C", "New Lead"];
// ONE canonical property-type list (lib/masterdata) — previously this file carried a
// divergent 5-item copy; the intake form + AI parser now share the governed list.
export { PROPERTY_TYPES } from "@/lib/masterdata";
export const BEDROOMS = ["Studio", "1", "2", "3", "4+"];
export const PURPOSES = [
  { id: "own", label: "ซื้ออยู่เอง" },
  { id: "invest", label: "ลงทุน / ปล่อยเช่า" },
  { id: "rent", label: "เช่า" },
];
export const SELL_REASONS = [
  { id: "upgrade", label: "ขยับขยาย" },
  { id: "relocate", label: "ย้ายที่อยู่" },
  { id: "cash", label: "ต้องการเงินสด" },
  { id: "invest_exit", label: "ขายทำกำไร" },
  { id: "other", label: "อื่นๆ" },
];

// role-specific requirements (stored as one JSON `requirements` object at wiring)
export interface BuyerRequirements {
  zone?: string;
  propertyType?: string;
  bedrooms?: string;
  purpose?: string;
}
export interface OwnerRequirements {
  propertyType?: string;
  askingPrice?: number;
  reason?: string;
}
export type Requirements = BuyerRequirements & OwnerRequirements;

export interface NewLead {
  lead_id: string;
  role: LeadRole; // buyer | owner (drives lead_type at wiring)
  lead_name: string;
  phone: string;
  lineId?: string; // LINE ID — a core contact field in the Lead Submission form
  source: LeadSource; // Marketing Channel (where the lead came from)
  contactBy?: ContactBy; // the inbox/method it arrived through
  gender?: string;
  nationality?: string;
  contactDate?: string; // when the customer contacted (YYYY-MM-DD)
  contactTime?: string; // HH:MM
  listing_code?: string; // interested / related listing
  budget?: number; // buyer budget or owner asking price (฿)
  potential?: string; // A / B / C / New Lead
  sale_id?: string; // assigned sales (nickname); "" = unassigned
  requirements: Requirements;
  remark?: string;
  // provenance
  created_by: string;
  date_received: string;
  intake_at: string;
}

// Admin follow-up state, per lead. Note: the "sale contacted the customer?" recheck is NOT
// stored — it's DERIVED from the pipeline stage (any stage past "Lead" = contacted), because
// the sale advancing Lead→Call IS the contact. Only complaint handling is manual here.
export interface LeadProcess {
  complaint?: boolean;
  complaintStatus?: string; // เปิด / กำลังแก้ไข / ปิด
  complaintRemark?: string;
  updatedBy?: string;
  updatedAt?: string;
}
export const COMPLAINT_STATUSES = ["เปิด", "กำลังแก้ไข", "ปิด"];

// Derived: has the assigned sale contacted the customer? True once the lead moves past the
// "Lead" stage (Call / Follow / Appoint / Show / Nego / Close / Win).
export function isContacted(pipelineStage: string | null | undefined): boolean {
  return !!pipelineStage && pipelineStage !== "Lead";
}

// ── interested-listing options WITH owner-sale, so the assignment default works in the
//    demo. Codes are real listing codes used elsewhere in the app. Wire: derive the
//    owner-sale from listing → zone → employees (Zone.sale_id_assigned). ────────────
export interface InterestListing {
  code: string;
  label: string;
  zone: string;
  sale: string; // owner-sale nickname
}
// `sale` must be an assignable sales agent (listSalesAgents) so the assign dropdowns can
// show it. Wire: this comes from the real listing → zone → employees join.
export const SAMPLE_INTEREST_LISTINGS: InterestListing[] = [
  { code: "CASK001", label: "Asoke Sky Residence · อโศก", zone: "อโศก", sale: "Pup" },
  { code: "CBGY001", label: "The Nern by Sansiri · บางจาก", zone: "บางจาก", sale: "Game" },
  { code: "CBGY002", label: "Ideo Mobi · บางจาก", zone: "บางจาก", sale: "Game" },
  { code: "HRM2002", label: "Baan Klang Muang · พระราม 2", zone: "พระราม 2", sale: "Q" },
  { code: "TRP1001", label: "The Rich Rama 9 · พระราม 9", zone: "พระราม 9", sale: "Mhow" },
  { code: "CRPK003", label: "Ratchapruek Villa · ราชพฤกษ์", zone: "ราชพฤกษ์", sale: "Golf" },
];

/** Default assignee = the interested listing's owner-sale (overridable by admin/CEO). */
export function defaultAssignee(listingCode: string | undefined): string {
  if (!listingCode) return "";
  return SAMPLE_INTEREST_LISTINGS.find((l) => l.code === listingCode)?.sale ?? "";
}

// Agents who can receive a lead — the six selling agents, INCLUDING Stone the player-coach
// CEO (the real Lead Submission "Sales Assigned" column shows Stone), which sales-dept-only
// filtering would wrongly exclude.
const SELLING_NICKNAMES = ["Stone", "Pup", "Game", "Q", "Mhow", "Golf"];
export function assignableAgents(): Employee[] {
  return listEmployees()
    .filter((e) => SELLING_NICKNAMES.includes(e.nickname))
    .sort((a, b) => SELLING_NICKNAMES.indexOf(a.nickname) - SELLING_NICKNAMES.indexOf(b.nickname));
}

// Client-only id generator for optimistic new leads (design build — real id comes from DB).
let _seq = 0;
export function nextLeadId(): string {
  _seq += 1;
  return `NEW-${String(_seq).padStart(3, "0")}`;
}

/** Blank draft for a fresh intake. */
export function emptyLead(createdBy: string, role: LeadRole = "buyer"): NewLead {
  return {
    lead_id: "",
    role,
    lead_name: "",
    phone: "",
    lineId: "",
    source: "ddproperty",
    contactBy: "line_oa",
    gender: "",
    nationality: "ไทย",
    contactDate: INTAKE_TODAY,
    contactTime: "",
    listing_code: "",
    budget: undefined,
    potential: "New Lead",
    sale_id: "",
    requirements: {},
    remark: "",
    created_by: createdBy,
    date_received: INTAKE_TODAY,
    intake_at: `${INTAKE_TODAY}T00:00:00+07:00`,
  };
}
