// SAMPLE DATA — CEO-governed controlled vocabularies (design-first, in-memory).
// These are the canonical lists everything else references; normalizing the messy
// source values into these is a DB-wiring must-fix (see DATA_MODEL.md). Action types
// live in lib/actions.ts (ACTION_GROUPS) since the app already uses them.

export const PROPERTY_TYPES: string[] = [
  "บ้านเดี่ยว",
  "บ้านแฝด",
  "ทาวน์โฮม",
  "ทาวน์เฮ้าส์",
  "คอนโด",
  "ที่ดิน",
  "อาคารพาณิชย์",
];

// Listing "potential" tier — the focus grade. Ordered by priority (top first).
// Source data has a messy variant ("A List + Fb add") that normalizes to "A List"
// via potentialGroup() in lib/status.ts; on DB wiring it becomes a stored enum.
// Exclusive + A List are the high-value tiers that get value-add checklists.
export const POTENTIALS: string[] = ["Exclusive", "A List", "Normal"];

export type TemplateKind = "count" | "baht" | "check";
export type TemplateSource = "activity" | "pipeline" | "manual";

export interface KpiTemplate {
  id: string;
  label: string;
  kind: TemplateKind;
  source: TemplateSource;
  /** For source="activity": the CRM action this metric counts. */
  activityType?: string;
  defaultTarget: number;
}

// The metric templates a manager picks from when assigning monthly targets — the
// definitions behind the Momentum targets (lib/momentum.ts).
export const KPI_TEMPLATES: KpiTemplate[] = [
  { id: "kt_call", label: "โทรหาลูกค้า", kind: "count", source: "activity", activityType: "Call", defaultTarget: 30 },
  { id: "kt_show", label: "พาชม", kind: "count", source: "activity", activityType: "Show", defaultTarget: 10 },
  { id: "kt_owner", label: "เยี่ยมเจ้าของ", kind: "count", source: "activity", activityType: "Owner Visit", defaultTarget: 12 },
  { id: "kt_reels", label: "ถ่าย Reels", kind: "count", source: "activity", activityType: "Reels", defaultTarget: 6 },
  { id: "kt_win", label: "ปิดการขาย", kind: "count", source: "pipeline", defaultTarget: 3 },
  { id: "kt_comm", label: "คอมมิชชั่น", kind: "baht", source: "pipeline", defaultTarget: 500000 },
];

export const KIND_LABEL: Record<TemplateKind, string> = {
  count: "นับจำนวน",
  baht: "บาท",
  check: "ทำ/ไม่ทำ",
};
export const SOURCE_LABEL: Record<TemplateSource, string> = {
  activity: "อัตโนมัติจากกิจกรรม",
  pipeline: "จากไปป์ไลน์",
  manual: "กรอกเอง",
};
