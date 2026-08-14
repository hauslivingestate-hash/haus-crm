import { createClient } from "@/lib/supabase/server";
import type { RefItem } from "@/components/MasterDataProvider";
import { TAG_TONE_ORDER, type LeadTag } from "@/lib/tags";

// The governed reference vocabularies, read from the DB rather than the seed constants.
//
// This matters beyond tidiness: every one of these columns is an FK to its lookup table, and
// the design-phase seeds used slug ids ("ddproperty", "line_oa", "male") that exist nowhere
// in the database. Submitting the intake form with those would fail every insert on a
// foreign-key violation — the same mismatch that COMPLAINT_STATUSES hit on 2026-08-08, but
// across the whole form.
//
// All of these are tiny (≤ 30 rows), so fetching the set on a request is cheap.

export interface Lookups {
  propertyTypes: RefItem[];
  sources: RefItem[]; // marketing_channel
  contactBys: RefItem[];
  genders: RefItem[];
  nationalities: RefItem[];
  leadTypes: RefItem[];
  purposes: RefItem[];
  sellReasons: RefItem[];
  /** listing_potential — NOT the same vocabulary as a lead's `potential` (A/B/C/New Lead). */
  listingPotentials: RefItem[];
  /** Zones are id + name (ASK · อโศก) rather than a bare name, unlike the other lookups. */
  zones: RefItem[];
  leadTags: LeadTag[];
}

/** Lookup tables keyed by `name` — the stored value IS the label. */
const NAME_TABLES = {
  propertyTypes: "property_type",
  sources: "marketing_channel",
  contactBys: "contact_by",
  genders: "gender",
  nationalities: "nationality",
  leadTypes: "lead_type",
  purposes: "lead_purpose",
  sellReasons: "sell_reason",
  listingPotentials: "listing_potential",
} as const;

export async function getLookups(): Promise<Lookups> {
  const supabase = await createClient();

  const nameEntries = Object.entries(NAME_TABLES) as [keyof typeof NAME_TABLES, string][];
  const [nameResults, zoneResult, tagResult] = await Promise.all([
    Promise.all(
      nameEntries.map(([, table]) => supabase.from(table).select("name").order("name"))
    ),
    supabase.from("zone").select("zone_id,name_thai").order("zone_id"),
    supabase
      .from("lead_tags_ref")
      .select("id,label,tone,sort_order")
      .eq("is_active", true)
      .order("sort_order")
      .order("id"),
  ]);

  const out = {} as Lookups;
  nameEntries.forEach(([key], i) => {
    const rows = (nameResults[i].data ?? []) as { name: string }[];
    out[key] = rows.map((r) => ({ id: r.name, label: r.name }));
  });

  // lead_type has no sort_order column, and plain alphabetical puts "Owner - Others" first —
  // so choosing "เจ้าของ" in the intake form would default to the catch-all rather than the
  // common case. Order it the way the business reads it instead.
  const LEAD_TYPE_ORDER = [
    "Buyer - Buy", "Buyer - Rent", "Co-Agent",
    "Owner - Sale", "Owner - Rent", "Owner - Others",
  ];
  out.leadTypes = [...out.leadTypes].sort((a, b) => {
    const ia = LEAD_TYPE_ORDER.indexOf(a.id);
    const ib = LEAD_TYPE_ORDER.indexOf(b.id);
    // Anything added later and not listed here sorts to the end, keeping its own order.
    return (ia < 0 ? LEAD_TYPE_ORDER.length : ia) - (ib < 0 ? LEAD_TYPE_ORDER.length : ib);
  });

  const zoneRows = (zoneResult.data ?? []) as { zone_id: string; name_thai: string | null }[];
  out.zones = zoneRows.map((z) => ({
    id: z.zone_id,
    label: z.name_thai ? `${z.name_thai} · ${z.zone_id}` : z.zone_id,
  }));

  // Tags carry a stored colour, so they are not RefItems — see lib/tags.ts.
  out.leadTags = ((tagResult.data ?? []) as {
    id: string;
    label: string | null;
    tone: string | null;
  }[]).map((t) => ({
    id: t.id,
    label: t.label ?? t.id,
    tone: (TAG_TONE_ORDER as readonly string[]).includes(t.tone ?? "")
      ? (t.tone as LeadTag["tone"])
      : "neutral",
  }));

  return out;
}

/** Active selling agents — who a lead can be assigned to. Value stored is employee_code. */
export interface AssignableAgent {
  employeeCode: string;
  nickname: string;
}

export async function getAssignableAgents(): Promise<AssignableAgent[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("main_1_hr")
    .select("employee_code,nickname")
    .eq("status", "Active")
    .eq("second_position", "Sales")
    .order("employee_code");
  return ((data ?? []) as { employee_code: string; nickname: string | null }[]).map((e) => ({
    employeeCode: e.employee_code,
    nickname: e.nickname ?? e.employee_code,
  }));
}
