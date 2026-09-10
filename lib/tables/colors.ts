import "server-only";

/* Loading the admin-chosen colour of every lookup value that paints a cell.

   One round trip for all five lists. They are tiny (30 rows in total) and
   every grid needs them, so a per-table query would be five requests for the
   same handful of bytes.

   Read with the caller's session like everything else. These tables are
   reference data readable by any authenticated user — the RLS that matters is
   on WRITING them, which lib/mutations/reference.ts gates. */

import { createClient } from "@/lib/supabase/server";
import { EMPTY_COLORS, type ColorMap, type LookupColors } from "./fills";
import type { SlaWindows } from "@/lib/sla";

const TABLES = [
  "lead_status",
  "pipeline_stage",
  "potential",
  "listing_status",
  "listing_potential",
] as const;

/** Colours for every list, keyed by table then value.

    A failure returns the empty map rather than throwing: a grid with no fills
    is a readable grid, and failing a page because a colour could not be read
    would be a worse outcome than a monochrome table. */
export async function getLookupColors(): Promise<LookupColors> {
  const supabase = await createClient();

  const results = await Promise.all(
    TABLES.map(async (t) => {
      const { data, error } = await supabase.from(t).select("name, color");
      if (error || !data) return [t, {} as ColorMap] as const;
      const map: ColorMap = {};
      for (const row of data as { name: string; color: string | null }[]) {
        map[row.name] = row.color;
      }
      return [t, map] as const;
    }),
  );

  return { ...EMPTY_COLORS, ...Object.fromEntries(results) } as LookupColors;
}

/** The same five lists, shaped for ตั้งค่า → สีสถานะ: every value with the
    colour it currently wears, ordered the way the grids order them.

    Separate from `getLookupColors` because the grids want a lookup map and the
    settings screen wants an ordered list with labels — same rows, two shapes,
    and collapsing them would make one of the two callers unpack something it
    does not want. */
export async function getColorableLists(): Promise<
  { table: string; label: string; hasSla: boolean; values: { name: string; color: string | null; slaDays: number | null }[] }[]
> {
  const supabase = await createClient();
  const LABELS: Record<(typeof TABLES)[number], string> = {
    lead_status: "สถานะลีด",
    pipeline_stage: "สเตจ (Pipeline)",
    potential: "เกรดลีด",
    listing_status: "สถานะทรัพย์",
    listing_potential: "เกรดทรัพย์",
  };

  const lists = await Promise.all(
    TABLES.map(async (t) => {
      // Only the two GRADE lists carry an SLA window; asking for the column
      // on a status list would 400. `hasSla` is what tells the settings screen
      // whether to offer the days box at all.
      const hasSla = SLA_TABLES.includes(t as (typeof SLA_TABLES)[number]);
      const { data } = await supabase
        .from(t)
        .select(hasSla ? "name, color, sort_order, sla_days" : "name, color, sort_order")
        .order("sort_order")
        .order("name");
      return {
        table: t as string,
        label: LABELS[t],
        hasSla,
        // Cast through unknown: the select string is chosen at runtime, so the
        // typed client cannot infer a shape for it.
        values: ((data ?? []) as unknown as { name: string; color: string | null; sla_days?: number | null }[]).map((r) => ({
          name: r.name,
          color: r.color,
          slaDays: r.sla_days ?? null,
        })),
      };
    }),
  );
  return lists;
}

/** The two grade lists that carry a follow-up window. */
export const SLA_TABLES = ["potential", "listing_potential"] as const;

/** grade name → window in days, for the leads grid and the listings grid.

    A grade with no row here, or a null, is OFF — see lib/sla.ts. Failure
    returns empty maps, which switches every SLA off rather than inventing
    deadlines from a failed read. */
export async function getSlaWindows(): Promise<{ lead: SlaWindows; listing: SlaWindows }> {
  const supabase = await createClient();
  const [lead, listing] = await Promise.all(
    SLA_TABLES.map(async (t) => {
      const { data, error } = await supabase.from(t).select("name, sla_days");
      if (error || !data) return {} as SlaWindows;
      const map: SlaWindows = {};
      for (const r of data as { name: string; sla_days: number | null }[]) map[r.name] = r.sla_days;
      return map;
    }),
  );
  return { lead, listing };
}
