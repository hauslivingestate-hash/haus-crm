// Lead group tag — a CEO-GOVERNED, SINGLE-SELECT classification (design-first).
//
// CEO feedback R1 (2026-07-29): "ให้มี Standard ที่ใช้กันทุกคนไปเลย" + "ติดได้คนเดียว".
// This replaces the previous free-form, multi-select, user-created tag model. Now:
//   • ONE tag per lead (a classification, not labels) — so the schema is a single FK
//     column `main_6_buyer_crm.tag_id`, NOT a join table.
//   • The list is a controlled vocabulary edited only in Settings → แท็ก Lead
//     (gated `masterdata.govern`). Sales pick from it; they cannot create.
//   • Colour is STORED per tag (CEO's choice), not derived from a hash — the point of a
//     standard is that everyone sees the same tag the same colour.
//
// Wired 2026-08-14: `lead_tags_ref(id, label, tone, sort_order, is_active)` +
// `main_6_buyer_crm.tag_id`, read in lib/lookups.ts and written in lib/mutations/reference.ts.
// The seed below survives only as the fallback for a render with no session.

const TAG_TONES = ["accent", "blue", "violet", "amber", "green", "neutral"] as const;
export type TagTone = (typeof TAG_TONES)[number];

export const TAG_TONE_ORDER: readonly TagTone[] = TAG_TONES;

// Tone → chip classes (uses the app's *-bg pill tokens).
export const TAG_TONE_CLASS: Record<TagTone, string> = {
  accent: "bg-accent-wash text-accent",
  blue: "bg-blue-bg text-blue",
  violet: "bg-violet-bg text-violet",
  amber: "bg-amber-bg text-amber",
  green: "bg-green-bg text-green",
  neutral: "bg-surface-2 text-text-muted",
};

export interface LeadTag {
  id: string;
  label: string;
  tone: TagTone;
}

// PLACEHOLDER SEED — mirrors what `lead_tags_ref` was seeded with. The CEO sets the real
// list in Settings, which now writes to that table (Ben, 2026-07-29:
// "เดี๋ยวให้ CEO เค้าเซ็ท เอา seed มาไวๆสัก 3-4 อันก่อนก็ได้").
//
// Deliberately a BUYER-TYPE axis, not hot/warm/cold: the lead already carries `potential`
// (A / B / C) for temperature — the Buyer Focus tab's conditional formatting keys off it —
// so a second grading field would compete with an existing one. Single-select also requires
// the values be mutually exclusive, which the old mixed-axis list (ร้อน + นักลงทุน +
// รอเงินกู้ …) was not.
export const SEED_LEAD_TAGS: LeadTag[] = [
  { id: "investor", label: "นักลงทุน", tone: "violet" },
  { id: "own_stay", label: "ซื้ออยู่เอง", tone: "green" },
  { id: "rent_out", label: "ปล่อยเช่า", tone: "blue" },
  { id: "foreigner", label: "ต่างชาติ", tone: "amber" },
];

/** Stable string hash — used only to seed which lead gets which tag in the demo. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Deterministic seed tag for a lead — exactly one, or null (~20% untagged), so the demo
 * shows real distribution on live rows. Replaced at wiring by the stored `tag_id`.
 */
export function seedTagForLead(leadId: string, tags: LeadTag[] = SEED_LEAD_TAGS): string | null {
  if (tags.length === 0) return null;
  const h = hash(leadId);
  if (h % 10 < 2) return null;
  return tags[(h >>> 3) % tags.length].id;
}

/** Build the initial lead → tagId map from a set of lead ids. */
export function seedTagState(
  leadIds: string[],
  tags: LeadTag[] = SEED_LEAD_TAGS
): Record<string, string | null> {
  const byLead: Record<string, string | null> = {};
  for (const id of leadIds) byLead[id] = seedTagForLead(id, tags);
  return byLead;
}

/** Resolve a stored tag id to its definition. Unknown ids (renamed/removed) return null. */
export function findTag(tags: LeadTag[], id: string | null | undefined): LeadTag | null {
  if (!id) return null;
  return tags.find((t) => t.id === id) ?? null;
}
