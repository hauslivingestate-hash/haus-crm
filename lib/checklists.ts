// SAMPLE DATA — value-add checklists for high-value listings (A-List / Exclusive).
// Design-first / in-memory (see components/ChecklistProvider.tsx). A template is an
// editable list of steps (edited in Settings); it targets one or both focus tiers. When a
// listing is A-List/Exclusive it shows every template whose `appliesTo` includes its tier.
//
// Wire later = tables `checklist_template` (name, applies_to[]), `checklist_template_item`
// (template_id, label, item_type, default_role), and per-listing `listing_checklist_item`
// (listing_id, template_item_id, completed_at/by, due_date, document_path, note). Documents
// → Supabase Storage. See CHECKLIST_FEATURE.md for the full schema + rationale.

import type { PotentialGroup } from "@/lib/status";

// Pill tones (mirror components/ui/Pill.tsx) used to colour role chips.
export type Tone = "neutral" | "accent" | "green" | "amber" | "blue" | "violet" | "red";

// Item behaviours:
//   task     — a checkbox (posted? done?)
//   document — attach a file (Supabase Storage on wiring; filename preview for now)
//   date     — a one-time due date with a countdown reminder
//   link     — paste a URL (copywriting template, portal post link) — done when present
//   cadence  — a re-post tracker: stamp the last-posted date, goes overdue past `repeatDays`
//              (mirrors the Listing Support sheet's "turn red after 6 days" rule)
export type ChecklistItemType = "task" | "document" | "date" | "link" | "cadence";

// Checklists only target the high-value tiers — not "Normal".
export type FocusTier = Exclude<PotentialGroup, "normal">; // "exclusive" | "a_list"

export interface ChecklistTemplateItem {
  id: string;
  label: string;
  type: ChecklistItemType;
  /** rbac role id (lib/rbac.ts) responsible for this step; null = unassigned. */
  role: string | null;
  /** For type="cadence": re-post every N days; the item goes overdue past this. */
  repeatDays?: number;
}

export interface ChecklistTemplate {
  id: string;
  name: string;
  appliesTo: FocusTier[];
  items: ChecklistTemplateItem[];
}

export const TIER_LABEL: Record<FocusTier, string> = {
  exclusive: "Exclusive",
  a_list: "A-List",
};

export const ITEM_TYPE_LABEL: Record<ChecklistItemType, string> = {
  task: "งาน",
  document: "เอกสาร",
  date: "กำหนดวันที่",
  link: "ลิงก์",
  cadence: "โพสต์ซ้ำ",
};

export const DEFAULT_REPEAT_DAYS = 6; // matches the sheet's group re-post cadence

// Roles a checklist step can be assigned to — the cross-team players who do listing
// value-add work. ids mirror lib/rbac.ts SEED_ROLES so wiring maps 1:1.
export const CHECKLIST_ROLES: { id: string; label: string; tone: Tone }[] = [
  { id: "agent", label: "Sales", tone: "blue" },
  { id: "listing_support", label: "Listing Support", tone: "amber" },
  { id: "marketing", label: "Marketing", tone: "violet" },
  { id: "sales_leader", label: "หัวหน้าทีม", tone: "accent" },
];

export function roleLabel(id: string | null | undefined): string {
  return CHECKLIST_ROLES.find((r) => r.id === id)?.label ?? "ไม่ระบุ";
}
export function roleTone(id: string | null | undefined): Tone {
  return CHECKLIST_ROLES.find((r) => r.id === id)?.tone ?? "neutral";
}

// Seed templates. Split into: prep work + the A-List posting tracker (mirrors the Listing
// Support "A LIst Post 2" sheet: Template Link · Marketplace · Profile · Group · Group Boost
// · DD · LV · PropertyHub) + Exclusive-only extras. All editable in Settings.
export const SEED_CHECKLIST_TEMPLATES: ChecklistTemplate[] = [
  {
    id: "tpl_prep",
    name: "งานเตรียมทรัพย์",
    appliesTo: ["a_list", "exclusive"],
    items: [
      { id: "it_owner_talk", label: "คุยเจ้าของ / ยืนยันราคา", type: "task", role: "agent" },
      { id: "it_photos", label: "ถ่ายรูปทรัพย์", type: "task", role: "listing_support" },
      { id: "it_deed", label: "โฉนด", type: "document", role: "listing_support" },
      { id: "it_owner_id", label: "สำเนาบัตรประชาชนเจ้าของ", type: "document", role: "listing_support" },
    ],
  },
  {
    id: "tpl_posting",
    name: "ลงประกาศ A List",
    appliesTo: ["a_list", "exclusive"],
    items: [
      { id: "it_fb_marketplace", label: "Facebook Marketplace", type: "task", role: "marketing" },
      { id: "it_fb_profile", label: "Facebook Profile / เพจ", type: "task", role: "marketing" },
      { id: "it_fb_group", label: "Facebook Group", type: "cadence", role: "marketing", repeatDays: 6 },
      { id: "it_fb_boost", label: "บูสต์โพสต์กลุ่ม", type: "cadence", role: "marketing", repeatDays: 6 },
      { id: "it_dd", label: "DDproperty", type: "link", role: "listing_support" },
      { id: "it_lv", label: "Livinginsider", type: "link", role: "listing_support" },
      { id: "it_propertyhub", label: "PropertyHub", type: "link", role: "listing_support" },
    ],
  },
  {
    id: "tpl_exclusive",
    name: "งานพิเศษ Exclusive",
    appliesTo: ["exclusive"],
    items: [
      { id: "it_pro_photo", label: "ถ่ายภาพมืออาชีพ", type: "task", role: "marketing" },
      { id: "it_reels", label: "ทำวิดีโอ / Reels", type: "task", role: "marketing" },
      { id: "it_banner", label: "แบนเนอร์เด่นบนเว็บพอร์ทัล", type: "task", role: "marketing" },
    ],
  },
];
