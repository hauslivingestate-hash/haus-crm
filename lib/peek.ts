"use client";

/* The row you just clicked, kept for the fraction of a second before the server answers.
 *
 * ── THE PROBLEM ─────────────────────────────────────────────────────────────────
 * The drawer is a route, so opening one costs a round trip: middleware revalidates the
 * session, then the detail runs its queries. Measured from this office that is ~0.4s per
 * trip to Supabase and about 1.2s in total — long enough that a click feels ignored.
 *
 * Klaichan's drawer is instant because its list has already loaded every lead in full, so
 * opening one is a state change and never a fetch. We deliberately did not copy that (see
 * components/ui/Drawer.tsx — it costs shareable links, Back-to-close, and a 1,058-row list
 * carrying every column for the few rows anyone opens).
 *
 * ── WHAT THIS DOES INSTEAD ──────────────────────────────────────────────────────
 * The grid already holds most of what the drawer shows — name, phone, stage, status,
 * grade, budget, owner, dates, commission, closing price. It is on screen at the moment of
 * the click. So the row is handed over here on the way out, and the drawer's loading state
 * renders it immediately with the REAL components while the server fills in the rest.
 *
 * The result is a panel that opens filled in, where only the activity log arrives late.
 *
 * ── WHY A MODULE VARIABLE AND NOT A CONTEXT ─────────────────────────────────────
 * The list and the drawer are separate route slots — siblings, not parent and child — so
 * no provider sits above both without wrapping the entire app in one. Both are client
 * components in the same bundle, so a module-level variable is the same object to each.
 *
 * ⚠️ NEVER READ THIS AS TRUTH. It is a placeholder that the server render replaces, and it
 * can be a few seconds stale. Nothing may be saved from it, and it is matched by id so a
 * cold link (no click) simply gets nothing and falls back to a skeleton.
 */

import type { CrmRow } from "@/lib/queries";

let lead: CrmRow | null = null;

/** Called by the grid on the way to /leads/:id. */
export function stashLead(row: CrmRow) {
  lead = row;
}

/** The stashed row, but only if it is the one being opened. */
export function peekLead(id: string): CrmRow | null {
  return lead && lead.lead_id === id ? lead : null;
}
