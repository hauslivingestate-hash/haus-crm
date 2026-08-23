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

// The metric templates a manager picks from when assigning monthly targets — the
// definitions behind the Momentum targets (lib/momentum.ts). Rows live in `kpi_template`;
// the seed there matches the list this file used to hold.
export interface KpiTemplate {
  /** DB-generated. null = a row the CEO just added that has not been saved yet. */
  id: number | null;
  label: string;
  kind: TemplateKind;
  source: TemplateSource;
  /** For source="activity": the CRM action this metric counts. */
  activityType?: string;
  defaultTarget: number;
}

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
