// The BUYER pipeline — main_6_buyer_crm.pipeline_stage. Owner side: lib/ownerPipeline.ts.
// Seeded stages: Lead | Call | Follow | Appoint | Show | Nego | Close | Win, editable in ตั้งค่า.

export interface StageMeta {
  key: string;
  /** What to show. The STORED NAME, verbatim — see below. */
  label: string;
  dot: string; // tailwind bg-* token utility
}

/* ⚠️ THE LABEL IS THE STORED NAME. Do not add a translation table here.
   This file used to map each stage to a Thai word (Lead → "ใหม่", Nego → "เจรจาต่อรอง").
   That was fine while the eight stages were frozen in code. They are editable in ตั้งค่า as
   of 2026-09-10, and a translation layer over an editable list means Settings shows one
   word and every other screen shows another — with any stage added later rendering in its
   own name anyway, beside ones that do not. Ben, 2026-09-10: the buyer pipeline is English.

   Only the COLOUR is decided here, because a colour is not a name. */
const STAGE_DOT: Record<string, string> = {
  Lead: "bg-dot-blue",
  Call: "bg-dot-teal",
  Follow: "bg-dot-violet",
  Appoint: "bg-dot-violet",
  Show: "bg-dot-amber",
  Nego: "bg-dot-crimson",
  Close: "bg-dot-green",
  Win: "bg-dot-green",
};

/** The seeded stages, in pipeline order. The live list comes from the `pipeline_stage`
    table via MasterDataProvider; this is the fallback when no lookups were loaded. */
export const STAGES: StageMeta[] = [
  "Lead", "Call", "Follow", "Appoint", "Show", "Nego", "Close", "Win",
].map((key) => ({ key, label: key, dot: STAGE_DOT[key] ?? "bg-text-subtle" }));

export const STAGE_MAP: Record<string, StageMeta> = Object.fromEntries(
  STAGES.map((s) => [s.key, s])
);

/** Display for a stored stage. A stage added in ตั้งค่า renders under its own name with a
    neutral dot — unknown to this file, but never invisible. An empty stage shows an em dash
    rather than pretending to be `Lead`, which the previous version did. */
export function stageMeta(key: string | null | undefined): StageMeta {
  if (!key) return { key: "", label: "—", dot: "bg-text-subtle" };
  return { key, label: key, dot: STAGE_DOT[key] ?? "bg-text-subtle" };
}

export const CLOSED_STAGES = ["Close", "Win"];
