/* Where a sheet-table cell's colour comes from.

   IT COMES FROM THE DATABASE. Each colour-bearing lookup table
   (`lead_status`, `pipeline_stage`, `potential`, `listing_status`,
   `listing_potential`) carries a `color` holding a palette token, editable at
   ตั้งค่า → ข้อมูลอ้างอิงกลาง. Nothing in this file names a status value.

   That is the whole point, and it is why the first version of this file was
   wrong: it hardcoded `case "Available"` and `case "Expired"` against a table
   whose real values are "Posted", "Ready to Post" and "Need Info", so most
   cells silently rendered unfilled. A literal status name in code is a bug
   waiting for someone to rename a list in Settings — here it was a bug on the
   day it shipped.

   The lookup tables are keyed on the label itself and every FK is
   ON UPDATE CASCADE, so a rename in Settings rewrites the value everywhere
   including the row this map is keyed by. The map is loaded per request, so it
   is never stale against the rows it colours. */

import type { CellFill } from "./index";
import { swatch } from "./palette";
import { slaFor, slaTone, type SlaWindows } from "@/lib/sla";

/** value → palette token, for one lookup list. */
export type ColorMap = Record<string, string | null>;

/** Every colour-bearing list, keyed by table name. Loaded by
    lib/tables/colors.ts and handed to a browser as a prop. */
export interface LookupColors {
  lead_status: ColorMap;
  pipeline_stage: ColorMap;
  potential: ColorMap;
  listing_status: ColorMap;
  listing_potential: ColorMap;
}

export const EMPTY_COLORS: LookupColors = {
  lead_status: {},
  pipeline_stage: {},
  potential: {},
  listing_status: {},
  listing_potential: {},
};

/** The one function every registry calls. A value with no colour set, or a
    value that is not in the list at all, returns undefined — the cell renders
    unfilled, which is the honest rendering of "nobody chose a colour". */
export function lookupFill(map: ColorMap | undefined, value: string | null | undefined): CellFill | undefined {
  if (!map || !value) return undefined;
  const s = swatch(map[value]);
  return s ? { hue: s.cssVar } : undefined;
}

/** The follow-up cell's colour, from the record's GRADE.

    Replaces the flat 7/30-day rule this file shipped with earlier, which
    ignored the grade entirely and so painted a rule the team does not work to.
    A grade with no window returns undefined and the cell stays unpainted —
    that is what switching an SLA off has to look like. */
export function slaFill(
  windows: SlaWindows | undefined,
  grade: string | null | undefined,
  lastContact: string | null | undefined,
): CellFill | undefined {
  const tone = slaTone(slaFor(windows, grade, lastContact));
  if (!tone) return undefined;
  const s = swatch(tone === "ok" ? "green" : tone === "warn" ? "amber" : "redStrong");
  return s ? { hue: s.cssVar } : undefined;
}
