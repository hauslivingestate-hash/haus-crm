/* The AI parse queue's CONTRACT — shared by the server runner and the browser.
 *
 * ⚠️ THIS FILE MUST NEVER IMPORT ANYTHING. Not lib/leads, not lib/listingFields, and above
 * all not anything that reaches @/lib/supabase/server. ParseTray and ParseQueueProvider are
 * "use client", and a client file importing a VALUE from a module whose import graph touches
 * next/headers drags it into the browser bundle and breaks the build. `tsc` does not catch
 * it — only the dev server does. lib/activityHeatmap.ts exists for the same reason, after
 * exactly that bug (2026-09-16).
 */

export type ParseKind = "lead" | "listing";
export type ParseStatus = "queued" | "running" | "done" | "error";

/** What a job is closed WITH. `saved` means the draft became a real record; `discarded`
 *  means it was thrown away. The difference is the only honest read on whether the
 *  extractor is good enough, so it is stored rather than inferred. */
export type ParseOutcome = "saved" | "discarded";

/* ── the two draft shapes ─────────────────────────────────────────────────────────
   Nullable-everything, by design: absent is null and never a guess. The model is told
   the same thing in Thai in every prompt (see lib/ai/extract.ts). */

/**
 * A parsed lead, keyed to match `LeadDraftInput` (lib/mutations/leads.ts) so LeadForm can
 * apply it field for field rather than translating.
 *
 * Every enum-shaped value here has ALREADY been resolved against the live lookup tables by
 * lib/ai/parse.ts — `interest_zone` is a zone_id, not the Thai name the model returned, and
 * `listing_code` is null unless it named a real listing. The form receives values the
 * database will accept, or nothing.
 */
export interface LeadParseDraft {
  lead_name: string | null;
  phone: string | null;
  line_id: string | null;
  lead_type: string | null;
  marketing_channel: string | null;
  contact_by: string | null;
  gender: string | null;
  nationality: string | null;
  budget: number | null;
  /** zone_id (ASK), resolved from the Thai name the model read. */
  interest_zone: string | null;
  interest_property_type: string | null;
  purpose: string | null;
  sell_reason: string | null;
  /** A REAL listing_id, or null. A code that names nothing is dropped and said so in `note`. */
  listing_code: string | null;
  remark: string | null;
  /** An existing lead with the same phone, when the parser could see one. Advisory only —
   *  RLS scopes this read to the parser's own leads unless they hold `leads.view_all`. */
  duplicateLeadId: string | null;
}

/**
 * A parsed listing.
 *
 * `values` is keyed EXACTLY as lib/listingFields.ts, so ListingForm applies it onto its
 * draft with no mapping table in between — which is what stops the parser and the form
 * drifting apart the way the add and edit screens once did. Only the keys listed in
 * AI_LISTING_KEYS (lib/ai/extract.ts) ever appear.
 */
export interface ListingParseDraft {
  values: Record<string, string>;
  /** The project picker is not a column, so it travels beside the values. */
  projectId: string | null;
  projectLabel: string | null;
  /** What the model actually read, kept even when nothing matched — so the form can show
   *  the name and let the person create the project rather than losing it. */
  projectNameRaw: string | null;
}

export type ParseDraft = LeadParseDraft | ListingParseDraft;

/** A job as the browser sees it. Dates are ISO strings: the tray only formats them, and
 *  strings keep the server-action payload boring. */
export interface ParseJob {
  id: number;
  kind: ParseKind;
  status: ParseStatus;
  rawText: string;
  draft: ParseDraft | null;
  note: string | null;
  error: string | null;
  title: string;
  createdAt: string;
}

/** Narrowing helpers — `draft` is a union and both sides need to read it safely. */
export function leadDraftOf(job: ParseJob | null | undefined): LeadParseDraft | null {
  return job && job.kind === "lead" && job.draft ? (job.draft as LeadParseDraft) : null;
}

export function listingDraftOf(job: ParseJob | null | undefined): ListingParseDraft | null {
  return job && job.kind === "listing" && job.draft ? (job.draft as ListingParseDraft) : null;
}

/** The permission that gates queuing this kind. Two keys, not one: lead parsing is a
 *  back-office tool Admin holds from day one, listing parsing starts off for sales. */
export const PARSE_PERMISSION: Record<ParseKind, string> = {
  lead: "ai.parse_lead",
  listing: "ai.parse_listing",
};

export const PARSE_KIND_LABEL: Record<ParseKind, string> = {
  lead: "ลีด",
  listing: "ทรัพย์",
};
