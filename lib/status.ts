// listing_status -> dot color token (status = dot + text)
const LISTING_STATUS_DOT: Record<string, string> = {
  Posted: "bg-green",
  "Ready to Post": "bg-amber",
  Update: "bg-blue",
  "Need Info": "bg-amber",
  Cancel: "bg-red",
  "Cancel Completed": "bg-text-subtle",
  Sold: "bg-accent",
  "Sold Completed": "bg-text-subtle",
};

export function listingStatusDot(status: string | null | undefined): string {
  return (status && LISTING_STATUS_DOT[status]) || "bg-text-subtle";
}

// potential -> Pill tone. Exclusive = brand accent; A/B/C etc. = amber; else neutral.
export function potentialTone(p: string | null | undefined): "neutral" | "accent" | "amber" {
  if (!p || p === "Normal") return "neutral";
  if (p.startsWith("Exclusive")) return "accent";
  return "amber";
}

// potential -> normalized focus tier. Collapses messy source values (e.g.
// "A List + Fb add") into the three governed tiers so filtering/grouping is exact.
// Priority order: Exclusive > A-List > Normal (mirrors potentialTone).
export type PotentialGroup = "exclusive" | "a_list" | "normal";
export function potentialGroup(p: string | null | undefined): PotentialGroup {
  if (!p || p === "Normal") return "normal";
  if (p.startsWith("Exclusive")) return "exclusive";
  return "a_list";
}

// High-value tiers get extra cross-team focus (value-add checklists).
export function isHighValue(p: string | null | undefined): boolean {
  return potentialGroup(p) !== "normal";
}

// lead_status -> dot color
const LEAD_STATUS_DOT: Record<string, string> = {
  Active: "bg-blue",
  Win: "bg-green",
  Lose: "bg-red",
  Reject: "bg-text-subtle",
};

export function leadStatusDot(status: string | null | undefined): string {
  return (status && LEAD_STATUS_DOT[status]) || "bg-text-subtle";
}
