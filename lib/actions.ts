// SAMPLE DATA + config — UI-first. The UNIFIED activity model (see DATA_MODEL.md
// "Design decisions"): one activity row is BOTH a KPI tally and an entity-timeline
// event. Modeled on the W Property FAB logger, extended so an action tags a lead
// OR a listing. Design phase = stubbed logging (the FAB does not write yet).

/** Where an action attaches. Drives the FAB's attach step + which timeline it lands in. */
export type AttachMode = "lead" | "listing" | "either" | "none";

export interface ActionGroup {
  group: string;
  attach: AttachMode;
  items: string[];
}

// The 23 messy source action values, canonicalized into groups (Show/Showing and
// Reels/ถ่าย Reels collapsed) and tagged by what they attach to.
export const ACTION_GROUPS: ActionGroup[] = [
  {
    group: "ไปป์ไลน์ (ลูกค้า)",
    attach: "lead",
    items: ["Call", "Follow", "Appoint", "Show", "Nego", "Close", "Win"],
  },
  {
    group: "งานทรัพย์",
    attach: "listing",
    items: ["Owner Visit", "Survey", "ประเมิน", "New List", "ถ่ายรูป", "Reels", "ติดป้าย", "โอน"],
  },
  {
    group: "ทั่วไป",
    attach: "none",
    items: ["ประชุม", "ทำงานหน้าคอม", "Sourcing", "อื่นๆ"],
  },
  {
    group: "บันทึกโน้ต",
    attach: "either",
    items: ["บันทึก"],
  },
];

export const NOTE_ACTION = "บันทึก";

/** Attach mode for a given action (defaults to "none" for unknowns). */
export function actionAttach(action: string | null | undefined): AttachMode {
  if (!action) return "none";
  const g = ACTION_GROUPS.find((g) => g.items.includes(action));
  return g?.attach ?? "none";
}

export interface Activity {
  id: string;
  created_by: string; // agent
  action: string;
  attach: AttachMode;
  related_lead_id: string | null;
  related_lead_name: string | null;
  related_listing_id: string | null;
  related_listing_name: string | null;
  date: string; // ISO
  count: number;
  remark: string | null;
}

// Sample log — references real listing IDs so listing-tagged rows resolve.
const SAMPLE: Activity[] = [
  { id: "a1", created_by: "Stone", action: "Show", attach: "lead", related_lead_id: "L-0007", related_lead_name: "คุณมีน", related_listing_id: null, related_listing_name: null, date: "2026-07-12", count: 1, remark: "พาชม 2 หลังในชัยพฤกษ์" },
  { id: "a2", created_by: "Stone", action: "Owner Visit", attach: "listing", related_lead_id: null, related_lead_name: null, related_listing_id: "TCYP001", related_listing_name: "Chaiyaphruek Park", date: "2026-07-12", count: 1, remark: "คุยราคาใหม่กับเจ้าของ" },
  { id: "a3", created_by: "Stone", action: "Call", attach: "lead", related_lead_id: "L-0011", related_lead_name: "คุณเบิร์ด", related_listing_id: null, related_listing_name: null, date: "2026-07-11", count: 1, remark: null },
  { id: "a4", created_by: "Stone", action: "Survey", attach: "listing", related_lead_id: null, related_lead_name: null, related_listing_id: "HRM2001", related_listing_name: "Rama 2 Grand Villa", date: "2026-07-11", count: 1, remark: "สำรวจสภาพก่อนถ่ายรูป" },
  { id: "a5", created_by: "Stone", action: "ประชุม", attach: "none", related_lead_id: null, related_lead_name: null, related_listing_id: null, related_listing_name: null, date: "2026-07-11", count: 1, remark: "ประชุมทีมเช้า" },
  { id: "a6", created_by: "Stone", action: "Reels", attach: "listing", related_lead_id: null, related_lead_name: null, related_listing_id: "CBGY001", related_listing_name: "The Nern by Sansiri", date: "2026-07-10", count: 2, remark: null },
  { id: "a7", created_by: "Stone", action: "Follow", attach: "lead", related_lead_id: "L-0007", related_lead_name: "คุณมีน", related_listing_id: null, related_listing_name: null, date: "2026-07-10", count: 1, remark: "ตามหลังพาชม ยังตัดสินใจอยู่" },
  { id: "a8", created_by: "Stone", action: "Appoint", attach: "lead", related_lead_id: "L-0014", related_lead_name: "คุณเอส", related_listing_id: null, related_listing_name: null, date: "2026-07-09", count: 1, remark: null },
  { id: "a9", created_by: "Stone", action: "ทำงานหน้าคอม", attach: "none", related_lead_id: null, related_lead_name: null, related_listing_id: null, related_listing_name: null, date: "2026-07-09", count: 1, remark: "ทำ presentation" },
  { id: "a10", created_by: "Stone", action: "Owner Visit", attach: "listing", related_lead_id: null, related_lead_name: null, related_listing_id: "CASK001", related_listing_name: "Asoke Sky Residence", date: "2026-07-08", count: 1, remark: null },
  { id: "a11", created_by: "Stone", action: "Sourcing", attach: "none", related_lead_id: null, related_lead_name: null, related_listing_id: null, related_listing_name: null, date: "2026-07-08", count: 3, remark: "หาทรัพย์ใหม่ย่านราชพฤกษ์" },
  { id: "a12", created_by: "Stone", action: "Nego", attach: "lead", related_lead_id: "L-0011", related_lead_name: "คุณเบิร์ด", related_listing_id: null, related_listing_name: null, date: "2026-07-07", count: 1, remark: "ต่อรองราคา รอเจ้าของตอบ" },
  { id: "a13", created_by: "Stone", action: "ถ่ายรูป", attach: "listing", related_lead_id: null, related_lead_name: null, related_listing_id: "HRM2002", related_listing_name: "Rama 2 Grand Villa", date: "2026-07-07", count: 1, remark: null },
  { id: "a14", created_by: "Stone", action: "Call", attach: "lead", related_lead_id: "L-0014", related_lead_name: "คุณเอส", related_listing_id: null, related_listing_name: null, date: "2026-07-06", count: 2, remark: null },

  // --- New-sales (probation) sample effort — Mhow & Golf, tallied by lib/probation ---
  // Mhow: entered 2026-05-01 → cleared Rookie (Call 36 รวม, Survey 6), mid-Junior.
  { id: "a15", created_by: "Mhow", action: "Call", attach: "lead", related_lead_id: null, related_lead_name: null, related_listing_id: null, related_listing_name: null, date: "2026-05-20", count: 12, remark: "โทรตามลีดโซนอโศก" },
  { id: "a16", created_by: "Mhow", action: "Call", attach: "lead", related_lead_id: null, related_lead_name: null, related_listing_id: null, related_listing_name: null, date: "2026-06-18", count: 10, remark: null },
  { id: "a17", created_by: "Mhow", action: "Call", attach: "lead", related_lead_id: null, related_lead_name: null, related_listing_id: null, related_listing_name: null, date: "2026-07-10", count: 14, remark: null },
  { id: "a18", created_by: "Mhow", action: "Survey", attach: "listing", related_lead_id: null, related_lead_name: null, related_listing_id: null, related_listing_name: null, date: "2026-05-28", count: 6, remark: "สำรวจทรัพย์ใหม่บางแวก" },
  { id: "a19", created_by: "Mhow", action: "Show", attach: "lead", related_lead_id: null, related_lead_name: null, related_listing_id: null, related_listing_name: null, date: "2026-06-25", count: 3, remark: null },
  { id: "a20", created_by: "Mhow", action: "Owner Visit", attach: "listing", related_lead_id: null, related_lead_name: null, related_listing_id: "CASK001", related_listing_name: "Asoke Sky Residence", date: "2026-07-05", count: 2, remark: null },
  // Golf: entered 2026-06-15 → mid-Rookie (Call 11/20, Survey 2/5).
  { id: "a21", created_by: "Golf", action: "Call", attach: "lead", related_lead_id: null, related_lead_name: null, related_listing_id: null, related_listing_name: null, date: "2026-06-24", count: 5, remark: null },
  { id: "a22", created_by: "Golf", action: "Call", attach: "lead", related_lead_id: null, related_lead_name: null, related_listing_id: null, related_listing_name: null, date: "2026-07-08", count: 6, remark: null },
  { id: "a23", created_by: "Golf", action: "Survey", attach: "listing", related_lead_id: null, related_lead_name: null, related_listing_id: null, related_listing_name: null, date: "2026-07-03", count: 2, remark: "สำรวจกับพี่เบนซ์" },
];

export function listActivities(): Activity[] {
  return [...SAMPLE].sort((a, b) => b.date.localeCompare(a.date));
}

/** Same rows, filtered to one listing — the entity-timeline view of the log. */
export function getActivitiesForListing(listingId: string | null | undefined): Activity[] {
  if (!listingId) return [];
  return listActivities().filter((a) => a.related_listing_id === listingId);
}

/** Same rows, filtered to one lead. */
export function getActivitiesForLead(leadId: string | null | undefined): Activity[] {
  if (!leadId) return [];
  return listActivities().filter((a) => a.related_lead_id === leadId);
}

// Sample attach options for the FAB dropdowns (design phase — real leads/listings
// wired later). Kept small on purpose.
export const SAMPLE_LEAD_OPTIONS = [
  { id: "L-0007", label: "คุณมีน · Show · ชัยพฤกษ์" },
  { id: "L-0011", label: "คุณเบิร์ด · Nego · พระราม 2" },
  { id: "L-0014", label: "คุณเอส · Appoint · อโศก" },
];

export const SAMPLE_LISTING_OPTIONS = [
  { id: "TCYP001", label: "TCYP001 · Chaiyaphruek Park" },
  { id: "HRM2001", label: "HRM2001 · Rama 2 Grand Villa" },
  { id: "CBGY001", label: "CBGY001 · The Nern by Sansiri" },
  { id: "CASK001", label: "CASK001 · Asoke Sky Residence" },
];
