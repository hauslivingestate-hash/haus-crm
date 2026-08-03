// Dashboard visual system — ported verbatim from the HAUS V2 sales dashboard tokens.js.
// Deliberately a self-contained token set (like HAUS V2's single source of truth) so the
// analytics dashboard matches the reference exactly. This is the ONE surface that uses the
// deep burgundy (#63041c) instead of the CRM shell's brighter crimson — a conscious choice
// to reproduce the HAUS dashboard look; the rest of the CRM keeps its own accent.
export const C = {
  bg: "#f8f8f8",
  card: "#ffffff",
  ink: "#0a0a0a",
  inkSoft: "#3d3d3d",
  muted: "#8a8a8a",
  border: "#e5e5e5",
  borderSoft: "#f0f0f0",
  accent: "#63041c", // HAUS Living burgundy — default data-bar / chart colour
  accentLight: "#9e2b46", // lighter burgundy — category emphasis (Close, focus-off bars)
  accentSoft: "#f5e6ea", // pale blush — tinted backgrounds
  gold: "#c9a96e", // champagne gold — leaderboard #1 only
  goldSoft: "#f9f4ea", // pale champagne surface — recognition spotlight
  goldFaint: "#e8dcc2", // faint gold — recognition border
  pos: "#16794a", // positive delta
  neg: "#a16207", // negative delta — amber-brown, never red (would fight burgundy)
} as const;

// Corner radius scale (HAUS bumped these up so it feels distinct).
export const R = { sm: 6, md: 10, lg: 16, pill: 999 } as const;

// Reuse the CRM mono face (IBM Plex Mono) — HAUS uses JetBrains Mono, but keeping the
// CRM's mono avoids shipping another font for a near-identical look.
export const FONT_MONO = "var(--font-mono)";

// Green activity-intensity scale (GitHub-style) — same HSL ramp as HAUS V2's heatCell.
export function heatCell(v: number, max: number): { bg: string; color: string } {
  if (!v) return { bg: C.borderSoft, color: C.muted };
  const intensity = Math.max(0.06, Math.min(1, v / max));
  const sat = 18 + 38 * intensity;
  const light = 84 - 36 * intensity;
  return { bg: `hsl(138, ${sat}%, ${light}%)`, color: intensity > 0.6 ? "#ffffff" : "#0a0a0a" };
}

/** % change vs a prior value; null when the prior is 0 (no baseline). */
export function delta(curr: number, prev: number): number | null {
  if (!prev) return null;
  return Math.round(((curr - prev) / prev) * 100);
}
