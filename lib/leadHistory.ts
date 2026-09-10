import type { LeadAuditRow } from "@/lib/leadTimeline";

/* Reassignment history — who handed this lead to whom.
 *
 * Replaced the in-memory trail that used to live in NewLeadsProvider and vanished on every
 * refresh. The real record is `audit_log`, written by assignLead() as
 * action `assign` with `{ sale_id: before }` → `{ sale_id: after }`.
 *
 * ── WHY THIS FILE NO LONGER READS THE DATABASE (2026-09-10) ─────────────────────
 * It used to run its own query: audit_log, this lead, action = 'assign'. But
 * getLeadTimeline() was already reading audit_log for the same lead with no action filter,
 * so the assign rows were in that result too — the same rows, fetched twice, on the
 * most-opened screen in the app.
 *
 * The reassignments are now derived from the rows the timeline already has. One read, two
 * uses. The two can no longer disagree about what happened to a lead, which was always the
 * more interesting risk: two queries against one table, ordered and capped independently,
 * feeding two halves of a single card.
 *
 * ── ON "READABLE" vs "EMPTY" ────────────────────────────────────────────────────
 * audit_log is selectable only with roles.manage, so everyone else gets zero rows from RLS.
 * That distinction has NOT been lost in the merge — it moved. getLeadTimeline() reports it
 * as `auditReadable`, and it is the same flag for the whole card now rather than one per
 * query. "Nothing was reassigned" and "you may not see reassignments" remain different
 * answers; there is just one place that decides which one you are getting.
 *
 * ── ONE DELIBERATE BEHAVIOUR CHANGE ─────────────────────────────────────────────
 * The old query had no row limit; the timeline's read is capped at the newest 100 audit
 * rows, so reassignments beyond that point are no longer shown. This is the coherent
 * version: a card showing "the last 100 things that happened" should not also claim to show
 * every reassignment since the beginning of time. No lead in the database is anywhere near
 * the cap (the busiest has 4 audit rows in total).
 */

export interface AssignHistoryEntry {
  at: string; // ISO datetime
  from: string | null; // null = was unassigned
  to: string | null; // null = unassigned
  by: string; // employee_code of whoever made the change
}

/** The `assign` rows out of a lead's audit trail, newest first — the caller's rows are
    already ordered, so this preserves rather than re-sorts them. */
export function assignEntries(audits: LeadAuditRow[]): AssignHistoryEntry[] {
  const entries: AssignHistoryEntry[] = [];
  for (const r of audits) {
    if (r.action !== "assign") continue;
    const before = r.before as { sale_id?: string | null } | null;
    const after = r.after as { sale_id?: string | null } | null;
    entries.push({
      at: r.created_at,
      from: before?.sale_id ?? null,
      to: after?.sale_id ?? null,
      by: r.changed_by,
    });
  }
  return entries;
}
