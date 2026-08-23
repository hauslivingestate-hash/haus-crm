// Value-add checklists for high-value listings (A-List / Exclusive).
//
// Two layers, both in the database:
//   • checklist_template + checklist_template_item — the definitions, edited in Settings
//   • listing_checklist_item                       — per-listing progress, ticked on the listing
//
// Progress is a LIVE JOIN against the templates, not a snapshot: a row exists only once an
// item is touched. Adding a step to a template therefore shows up on every A-List listing
// immediately, with no backfill.
//
// ⚠️ The A-List posting template covers the same seven steps as the Support-filled columns on
// `main_10_potential_listing` (template_link / marketplace / profile / group_date /
// group_boost_date). Ben chose this side, 2026-08-23 — those columns are no longer used. They
// were all still empty (0/210), so nothing was lost. `main_10` keeps its real job: the trigger
// that decides which listings are A-List in the first place.

import type { PotentialGroup } from "@/lib/status";

// Pill tones (mirror components/ui/Pill.tsx) used to colour role chips.
export type Tone = "neutral" | "accent" | "green" | "amber" | "blue" | "violet" | "red";

// Item behaviours:
//   task     — a checkbox (posted? done?)
//   document — paste the Google Drive link to the document (โฉนด, สำเนาบัตร) — done when present
//   date     — a one-time due date with a countdown reminder
//   link     — paste a URL (copywriting template, portal post link) — done when present
//   cadence  — a re-post tracker: stamp the last-posted date, goes overdue past `repeatDays`
//              (mirrors the Listing Support sheet's "turn red after 6 days" rule)
//
// `document` deliberately stores a LINK, not a file. Ben, 2026-08-23: title deeds and copies
// of the owner's ID card stay in Google Drive where they already live — keeping that PII out
// of Supabase, and out of the storage quota the listing photos are already eating.
export type ChecklistItemType = "task" | "document" | "date" | "link" | "cadence";

// Checklists only target the high-value tiers — not "Normal".
export type FocusTier = Exclude<PotentialGroup, "normal">; // "exclusive" | "a_list"

export interface ChecklistTemplateItem {
  /** DB-generated. null = added in the editor and not saved yet. */
  id: number | null;
  label: string;
  type: ChecklistItemType;
  /** roles.id — the team responsible for this step; null = unassigned. */
  role: string | null;
  /** For type="cadence": re-post every N days; the item goes overdue past this. */
  repeatDays?: number;
}

export interface ChecklistTemplate {
  id: number | null;
  name: string;
  appliesTo: FocusTier[];
  items: ChecklistTemplateItem[];
}

/** Per-listing state for one checklist item. */
export interface ChecklistItemState {
  completedAt: string | null; // ISO timestamp — task/date completion
  completedBy: string | null; // employee_code
  dueDate: string | null; // "YYYY-MM-DD" — due date (date) or last-posted date (cadence)
  url: string | null; // link + document (a Drive URL for the latter)
  note: string | null;
}

export const EMPTY_ITEM_STATE: ChecklistItemState = {
  completedAt: null,
  completedBy: null,
  dueDate: null,
  url: null,
  note: null,
};

/** Progress for one listing, keyed by template_item_id. */
export type ProgressMap = Record<number, ChecklistItemState>;

// Exclusive listing agreement — the signed contract's term (Exclusive tier only). We commit
// to selling within this window, so `end` drives the expiry warning.
// Stored on main_4_listing_database, NOT main_10: the trigger deletes a listing's main_10 row
// the moment it drops out of the A-List criteria, which would take the contract dates with it.
export interface ExclusiveAgreement {
  start: string | null; // "YYYY-MM-DD"
  end: string | null; // "YYYY-MM-DD"
}

export const EMPTY_AGREEMENT: ExclusiveAgreement = { start: null, end: null };

export const TIER_LABEL: Record<FocusTier, string> = {
  exclusive: "Exclusive",
  a_list: "A-List",
};

export const ITEM_TYPE_LABEL: Record<ChecklistItemType, string> = {
  task: "งาน",
  document: "เอกสาร (ลิงก์)",
  date: "กำหนดวันที่",
  link: "ลิงก์",
  cadence: "โพสต์ซ้ำ",
};

export const DEFAULT_REPEAT_DAYS = 6; // matches the sheet's group re-post cadence

// Tones for the role chips. The dropdown of assignable roles comes from the `roles` table —
// this map only colours the ones we have an opinion about, and anything else falls back to
// neutral rather than disappearing.
const ROLE_TONE: Record<string, Tone> = {
  agent: "blue",
  listing_support: "amber",
  marketing: "violet",
  sales_leader: "accent",
  ceo: "accent",
  admin: "neutral",
  hr: "neutral",
  system_admin: "neutral",
};

export function roleTone(id: string | null | undefined): Tone {
  return (id && ROLE_TONE[id]) || "neutral";
}

/** Label for a role id, given the roster of roles loaded from the DB. */
export function roleLabel(
  id: string | null | undefined,
  roles: { id: string; name: string }[]
): string {
  if (!id) return "ไม่ระบุ";
  return roles.find((r) => r.id === id)?.name ?? id;
}

/** Whole days between `dateStr` (YYYY-MM-DD) and today. Positive = in the past. */
export function daysSince(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${dateStr}T00:00:00`);
  return Math.round((today.getTime() - d.getTime()) / 86_400_000);
}

// "Done" depends on the item type: task/date checked off · document or link supplied ·
// cadence posted within its repeat window.
export function isDone(item: ChecklistTemplateItem, st: ChecklistItemState): boolean {
  switch (item.type) {
    case "document":
    case "link":
      return !!st.url;
    case "cadence":
      return !!st.dueDate && daysSince(st.dueDate) <= (item.repeatDays ?? DEFAULT_REPEAT_DAYS);
    default:
      return !!st.completedAt; // task, date
  }
}

/** Templates that apply to a listing's tier — empty for Normal. */
export function templatesForTier(
  templates: ChecklistTemplate[],
  group: PotentialGroup
): ChecklistTemplate[] {
  if (group === "normal") return [];
  return templates.filter((t) => t.appliesTo.includes(group as FocusTier));
}
