// The `Project` shape and the pure helpers over it.
//
// Phase 6 removed the sample rows: projects come from `main_3_property_detail` now (308 of
// them), read by `getProjects()` / `getProject()` in lib/queries.ts. The queries live there
// rather than here because ProjectsBrowser is a client component and imports
// `projectCompleteness` as a value — pulling `lib/supabase/server` (and with it
// `next/headers`) into this module would break its bundle.
//
// Field names are kept from the design build even where the column is named differently,
// so the browser and detail page did not have to be rewritten: `units` ← total_units,
// `age` ← project_age, `common_area` ← facilities, `resident_persona` ←
// resident_occupation, `closing_price` ← project_sold_price.

export interface Project {
  /** Routing key — the real `project_id` (PROJECT-001), not a slug of the name. */
  id: string;
  name_eng: string;
  name_thai: string;
  property_type: string | null;
  /** Thai zone name for display. The stored value is a zone_id code (RP1); showing that
   *  raw would repeat the /assign mistake of putting internal codes in front of people. */
  zone: string | null;
  units: string | null;
  phases: string | null;
  unit_types: string | null;
  material: string | null;
  floor_to_ceiling: string | null;
  age: string | null;
  common_area: string | null;
  common_fee: string | null;
  juristic: string | null;
  fee_collection_rate: string | null;
  overflow_parking_fee: string | null;
  rental_range: string | null;
  flood: string | null;
  resident_persona: string | null;
  closing_price: string | null;
  pros: string | null;
  cons: string | null;
  /** Nickname of the sale who owns the record, not their employee code. */
  created_by: string | null;
}

/** How "filled in" a project is — the source sheet is mostly sparse, so the list
 *  surfaces this to nudge agents to complete records. */
export function projectCompleteness(p: Project): number {
  const fields = [
    p.units, p.phases, p.unit_types, p.material, p.age, p.common_fee, p.juristic,
    p.flood, p.resident_persona, p.pros, p.cons, p.closing_price,
  ];
  const filled = fields.filter((v) => v != null && v !== "").length;
  return Math.round((filled / fields.length) * 100);
}
