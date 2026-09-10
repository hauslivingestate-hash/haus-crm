// Maps main_4_listing_database.owner_stage -> Thai display + stage dot.
// The owner-side twin of lib/pipeline.ts. Read both together.
//
// ── TWO PIPELINES, AND WHY THEY ARE NOT ONE ─────────────────────────────────────
// A deal has two halves and the company only ever tracked one of them:
//
//   BUYER  main_6_buyer_crm.pipeline_stage   Lead → Call → … → Nego → Win
//   OWNER  main_4_listing_database.owner_stage   Sourcing → Owner Talk → … → Sold
//
// They move independently. A listing can be Exclusive on the owner side while every buyer
// on it is still at Show, and a buyer can reach Nego on a listing whose owner has gone
// quiet. Collapsing them into one number is how "how is this deal going?" stops having an
// answer.
//
// ⚠️ NOT `listing_status`. That is the marketing queue for the advert — Need Info → Ready
// to Post → Posted — and it answers "is the listing live?", not "where has the owner
// conversation got to?". A unit can sit at Posted for six months while the owner drifts
// from warm to dead, and before owner_stage existed nothing recorded that.

export interface OwnerStageMeta {
  key: string;
  /** What to show. The STORED NAME, verbatim — see below. */
  label: string;
  dot: string; // tailwind bg-* token utility
}

/* ⚠️ THE LABEL IS THE STORED NAME. Do not add a translation table here.
   These stages were named by Ben, in English, and they are editable in ตั้งค่า. A code-side
   Thai mapping (my first cut had one: Owner Visit → "นัดดูทรัพย์") means Settings shows one
   word and the app shows another, so nobody can be sure which stage they just edited — and
   any stage added later has no translation and renders in English anyway, next to ones that
   do not. Whatever the team types is what the team sees. To change the wording, rename the
   stage in ตั้งค่า; ON UPDATE CASCADE carries every listing with it.

   Only the COLOUR is decided here, because a colour is not a name. */
const OWNER_STAGE_DOT: Record<string, string> = {
  "New List": "bg-dot-amber",
  "Owner Talk": "bg-dot-teal",
  "Owner Visit": "bg-dot-violet",
  "Exclusive Offer": "bg-dot-crimson",
};

/** The seeded stages, in pipeline order. The live list comes from the `owner_stage` table
    via MasterDataProvider; this is the fallback for a session that loaded no lookups. */
export const OWNER_STAGES: OwnerStageMeta[] = [
  "New List",
  "Owner Talk",
  "Owner Visit",
  "Exclusive Offer",
].map((key) => ({ key, label: key, dot: OWNER_STAGE_DOT[key] ?? "bg-text-subtle" }));

/** Display for a stored stage. A stage added in ตั้งค่า renders under its own name with a
    neutral dot — unknown to this file, but never invisible. */
export function ownerStageMeta(key: string | null | undefined): OwnerStageMeta {
  if (!key) return { key: "", label: "—", dot: "bg-text-subtle" };
  return { key, label: key, dot: OWNER_STAGE_DOT[key] ?? "bg-text-subtle" };
}

/* ⚠️ THERE IS NO "SOLD" OR "DROPPED" OWNER STAGE, and there must not be one.
   Whether a property is live, sold or cancelled is `listing_status` — it always was, and it
   is what the whole company already reads. An owner_stage that also claimed to know would be
   a second answer to a settled question, and the two would disagree within a week.
   This pipeline answers one thing only: how far the owner conversation got. */
