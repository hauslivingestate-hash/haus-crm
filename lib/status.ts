/* Presentation rules for the lead/listing values that are NOT governed colours.

   ⚠️ NO STATUS → COLOUR MAP LIVES HERE. `lead_status`, `listing_status` and
   `pipeline_stage` wear the swatch chosen in ตั้งค่า → สีสถานะ on EVERY surface: grid
   cells through lookupFill, dots through lookupDot (lib/tables/fills.ts), read from
   useMasterData().colors on the client and getLookupColors() on the server. This file
   used to carry its own maps for the dots, which is how Lead Database drew "Active" in
   navy while the Lead grid drew it in the Settings blue (Ben, 2026-09-16). Potential
   stays below because it is a Pill tone and a grouping rule, not a governed colour. */

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
