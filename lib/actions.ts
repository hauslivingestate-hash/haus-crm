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

// The sample log is gone. `activities` holds 2,334 real rows, read through
// getActivityFeed / getActivitiesForListing / getActivitiesForLead in lib/queries.ts.
// What stays here is the type and the pure helpers, which client components import.
//
// ⚠️ ACTION_GROUPS below is the design-phase vocabulary and is missing three rows the
// `action_type` table actually has (Owner Talk, Update Price, เซ็นสัญญา). It has caused the
// same bug three times — the task form, the rank editor, the activity-type editor — so
// anything that must produce an FK-valid action name reads the table via getActionTypes()
// instead. Only NOTE_ACTION and the AttachMode type are safe to use from here.
