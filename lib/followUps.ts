/* ติดตามเกินกำหนด — the records past their follow-up window.
 *
 * Types only. The read is in lib/salesDashboard.ts and the writes are in
 * lib/mutations/followUps.ts, which is a "use server" module and may therefore export
 * nothing but async functions.
 *
 * ── NOTHING HERE IS STORED ──────────────────────────────────────────────────────
 * Every row is DERIVED: last contact compared against the window on the record's grade,
 * recomputed on each render. A row leaves this list because the record was contacted, not
 * because anybody marked it. That is why overdue-ness is never written into the plan as a
 * task by itself — `tasks.done` is something a person wrote down, overdue-ness stops
 * being true on its own, and copying one into the other lets them drift in both
 * directions. Promoting a row to the plan is a deliberate act with its own button.
 *
 * ── BOTH SIDES OF THE BUSINESS ──────────────────────────────────────────────────
 * Leads (last_follow_date vs `potential.sla_days`) AND listings (owner_talk_last_date vs
 * `listing_potential.sla_days`). The owner half was invisible until 2026-09-10 even
 * though both columns already existed — so an owner unheard from for two months ranked
 * below a lead one day over.
 */

export type FollowUpSide = "lead" | "listing";

export interface FollowUpRow {
  side: FollowUpSide;
  /** lead_id or listing_id. */
  id: string;
  /** WHO to contact — the lead's name, or the OWNER's name on a listing, not the
      building's. You do not ring a condo. */
  name: string;
  /** WHAT it is about, because the name alone does not say which unit. */
  subtitle: string | null;
  /** The grade whose window was used. */
  grade: string | null;
  /** Days since last contact. null = never contacted. */
  days: number | null;
  /** The grade's window, in days. */
  window: number;
  /** Days past the window; 0 when never contacted — there is no "past" to measure. */
  over: number;
  /** Already promoted onto today's plan and not yet ticked. Kept visible and marked
      rather than hidden: a list that shrinks when you claim a row reads as shorter than
      the work actually is. */
  onPlan: boolean;
}

export interface OverdueFollowUps {
  /** Capped for the card. `totalLeads + totalListings` is the real size. */
  rows: FollowUpRow[];
  totalLeads: number;
  totalListings: number;
}

/** One recent conversation, for the drawer. */
export interface FollowUpNote {
  id: number;
  /** The action logged, or null for a bare note. */
  kind: string | null;
  date: string;
  note: string | null;
}

/** What the drawer shows: enough to make the call without opening the record. */
export interface FollowUpDetail {
  phone: string | null;
  lineId: string | null;
  /** Pipeline stage for a lead, owner stage for a listing. */
  state: string | null;
  subtitle: string | null;
  /** Newest first. */
  recent: FollowUpNote[];
}

/** Rows are keyed by side+id: a lead id and a listing id cannot collide today, but the
    union makes that an accident rather than a rule. */
export function followUpKey(r: { side: FollowUpSide; id: string }): string {
  return `${r.side}:${r.id}`;
}

/* WHICH ACTION A FOLLOW-UP LOGS, per side.
 *
 * These are `action_type` names and both are FK-checked, so a rename in ตั้งค่า would
 * break the write loudly rather than silently logging nothing. They are also the two
 * actions whose write updates the record's follow-up clock (lib/mutations/activity.ts),
 * which is what makes the row leave this list. Changing either one without changing that
 * is how a "log" button stops clearing the thing it logged. */
export const FOLLOW_UP_ACTION: Record<FollowUpSide, string> = {
  lead: "Follow",
  listing: "Owner Talk",
};
