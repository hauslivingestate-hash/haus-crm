// Lead intake model — the admin "receive from any channel → log → assign" flow.
// Ported from the Custom Dashboard LeadForm/CompanyLeads references, mapped onto the HAUS
// schema. Leads live in Supabase (main_6_buyer_crm) which the design build reads read-only,
// so NEW leads created here are OPTIMISTIC/local (NewLeadsProvider) — not persisted. The
// shape mirrors the eventual insert. See DATA_MODEL → "Lead intake & assignment".
//
// New vs main_6_buyer_crm: `source` (ช่องทาง) and the `requirements` block are NOT columns
// yet — add them at wiring (a `source` column + a `requirements` jsonb, or normalized cols).


/** Today, as YYYY-MM-DD in local time — the default intake date. */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Design-phase constant, still used by the in-memory assignment history (Phase 5 #4). */
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

// The intake form's working draft. Every vocabulary field below holds the DB's own value
// (an FK target), NOT a slug — see lib/lookups.ts.
export interface NewLead {
  lead_id: string;
  role: LeadRole; // buyer | owner — a UI axis that filters lead_type + swaps the requirements
  lead_type?: string; // 'Buyer - Buy' | 'Owner - Sale' | … (lead_type lookup)
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
  /** Assigned sales — an EMPLOYEE CODE (S-004), not a nickname; "" = unassigned. */
  sale_id?: string;
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
// Matches the `complain_status` lookup table exactly (FK, on update cascade) — same
// convention as lead_status/potential elsewhere in the app: shown as the raw DB value,
// no separate Thai translation layer.
export const COMPLAINT_STATUSES = ["Open", "In Progress", "Resolved", "Closed"];

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

/**
 * Blank draft for a fresh intake.
 *
 * The vocabulary fields start EMPTY rather than pre-picked: their values come from the DB
 * lookups at render time, and guessing a default here is how the old seed slugs
 * ("ddproperty", "line_oa", "ไทย") ended up in a form that could never write them.
 */
export function emptyLead(createdBy: string, role: LeadRole = "buyer"): NewLead {
  const today = todayISO();
  return {
    lead_id: "",
    role,
    lead_type: "",
    lead_name: "",
    phone: "",
    lineId: "",
    source: "",
    contactBy: "",
    gender: "",
    nationality: "",
    contactDate: today,
    contactTime: "",
    listing_code: "",
    budget: undefined,
    potential: "New Lead",
    sale_id: "",
    requirements: {},
    remark: "",
    created_by: createdBy,
    date_received: today,
    intake_at: `${today}T00:00:00+07:00`,
  };
}
