import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";

// Page data reads run on the SESSION-AWARE server client. The old sessionless anon client
// (lib/supabase.ts) is deleted, not merely unused: RLS filters every table below on
// `current_employee_code()` / `has_perm()`, which are NULL/false without a session, so any
// query made through it would silently return zero rows now that `demo_read_all` is gone.
//
// Consequence, and it is the correct one: reading cookies makes these pages dynamic, so the
// 30s ISR window is gone. A page cached for one user must never be served to another now that
// two users legitimately see different rows.
//
// Server-only by construction: `cookies()` throws outside a request, so importing this from a
// client component is a build error rather than a silent leak.

export interface CrmRow {
  lead_id: string;
  lead_name: string | null;
  phone: string | null;
  line_id?: string | null;
  potential: string | null;
  lead_status: string | null;
  pipeline_stage: string | null;
  lead_type: string | null;
  sale_id: string | null;
  listing_code: string | null;
  budget: number | null;
  commission: number | null;
  last_follow_date: string | null;
  closing_date: string | null;
  date_received: string | null;
}

// Mirrors `v_main_listing` in full — all 55 exposed columns. Types were probed against the
// live schema (not inferred from sample rows, which are mostly null): `floor` and `unit_no`
// really are TEXT; `parking` is an integer; sign/vdo/owner_focus are booleans; the three
// *_date columns are dates. Keep this in sync with LISTING_COLUMNS below.
//
// NOT here because the view doesn't expose them yet (15 sheet columns — Hook, ส่วนกลาง,
// อายุ, Photo Album, Link, Last Match Price/Remark/Type, New Photo, Facebook Ad, DD Boost,
// LV Boost, FB Repost, Marketing Report). See CEO_FEEDBACK_R1.md §2.3.
export interface ListingRow {
  // Identity & status
  listing_id: string;
  listing_name: string | null;
  listing_status: string | null;
  potential: string | null;
  listing_type: string | null;
  owner_focus: boolean | null;
  date_created: string | null;
  created_at: string | null;
  updated_at: string | null;
  days_on_market: number | null;
  /** Managing agent. Present in the view but NULL in the live rows — until the import
   *  backfills it, `lib/listings.ts` seeds a stand-in. Delete that seed once populated. */
  created_by: string | null;

  /** Who manages this listing. `sale_id` is what the row states; `effective_sale_id` falls
   *  back to the zone's primary agent when it is blank, and is the one to scope "mine" by —
   *  a listing with no agent still belongs to whoever owns the zone. */
  sale_id: string | null;
  effective_sale_id: string | null;

  // Location
  project_id: string | null;
  project_name_eng: string | null;
  zone: string | null;
  zone_name_thai: string | null;
  zone_name_eng: string | null;
  in_out_project: string | null;
  road_soi: string | null;
  link_location: string | null;

  // Specs
  property_type: string | null;
  unit_no: string | null;
  bed: number | null;
  bath: number | null;
  area_rai: number | null;
  area_ngan: number | null;
  area_wa: number | null;
  area_sqm: number | null;
  floor: string | null;
  building: string | null;
  direction: string | null;
  view_type: string | null;
  unit_position: string | null;
  parking: number | null;
  unit_condition: string | null;

  // Pricing
  asking_price: number | null;
  rental_price: number | null;
  old_price: number | null;
  new_price: number | null;
  update_remark: string | null;
  price_remark: string | null;

  // Owner
  owner_id: number | null;
  owner_name: string | null;
  owner_phone: string | null;
  owner_line: string | null;
  owner_talk_last_date: string | null;
  activity_comment: string | null;

  // Marketing / portals
  sign: boolean | null;
  vdo: boolean | null;
  ddproperty_link: string | null;
  livinginsider_link: string | null;
  livinginsider_date: string | null;
  propertyhub_link: string | null;
  shorts_reels_link: string | null;
  hometour_link: string | null;

  // Misc
  remark: string | null;
}

/** Every column of `v_main_listing`, in the ListingRow order. Single source for both queries. */
const LISTING_COLUMNS = [
  "listing_id", "listing_name", "listing_status", "potential", "listing_type", "owner_focus",
  "date_created", "created_at", "updated_at", "days_on_market", "created_by",
  "sale_id", "effective_sale_id",
  "project_id", "project_name_eng", "zone", "zone_name_thai", "zone_name_eng",
  "in_out_project", "road_soi", "link_location",
  "property_type", "unit_no", "bed", "bath", "area_rai", "area_ngan", "area_wa", "area_sqm",
  "floor", "building", "direction", "view_type", "unit_position", "parking", "unit_condition",
  "asking_price", "rental_price", "old_price", "new_price", "update_remark", "price_remark",
  "owner_id", "owner_name", "owner_phone", "owner_line", "owner_talk_last_date",
  "activity_comment",
  "sign", "vdo", "ddproperty_link", "livinginsider_link", "livinginsider_date",
  "propertyhub_link", "shorts_reels_link", "hometour_link",
  "remark",
].join(",");

export interface SaleStatusRow {
  employee_code: string;
  nickname: string | null;
  first_name_en: string | null;
  zones: string | null;
  total_leads: number;
  total_crm: number;
  crm_win: number;
  total_commission: number;
  total_listings: number;
  total_matches: number;
  total_match_value: number;
}

export async function getCrm(): Promise<CrmRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("main_6_buyer_crm")
    .select(
      "lead_id,lead_name,phone,potential,lead_status,pipeline_stage,lead_type,sale_id,listing_code,budget,commission,last_follow_date,closing_date,date_received"
    )
    .order("date_received", { ascending: false });
  return (data as CrmRow[]) ?? [];
}

export async function getListings(): Promise<ListingRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_main_listing")
    .select(LISTING_COLUMNS)
    .order("listing_id");
  return (data as unknown as ListingRow[]) ?? [];
}

/**
 * The listings this person manages — what the "ทรัพย์" page shows.
 *
 * Scoping lives here, not in RLS: the company-listings page reads the same table and must
 * still see every row (that page exists so agents can find a co-agent). What RLS does
 * enforce is the part that actually leaks — owner phone/line come back NULL for listings
 * you don't manage unless you hold `contacts.view_all`.
 *
 * Back-office roles (marketing, admin, HR) manage no listings, so this is empty for them by
 * design; ทรัพย์ทั้งบริษัท is their surface.
 */
export async function getMyListings(): Promise<ListingRow[]> {
  const auth = await getAuthContext();
  const all = await getListings();
  // No session (AUTH_ENFORCED off) → keep the design-phase behaviour of showing everything,
  // otherwise the page reads as broken rather than as scoped.
  if (!auth?.employeeCode) return all;
  return all.filter((l) => l.effective_sale_id === auth.employeeCode);
}

export async function getLead(id: string): Promise<CrmRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("main_6_buyer_crm")
    .select(
      "lead_id,lead_name,phone,line_id,potential,lead_status,pipeline_stage,lead_type,sale_id,listing_code,budget,commission,last_follow_date,closing_date,date_received"
    )
    .eq("lead_id", id)
    .maybeSingle();
  return (data as CrmRow | null) ?? null;
}

export async function getListing(id: string): Promise<ListingRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_main_listing")
    .select(LISTING_COLUMNS)
    .eq("listing_id", id)
    .maybeSingle();
  return (data as unknown as ListingRow | null) ?? null;
}

export async function getSaleStatus(): Promise<SaleStatusRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_sale_status")
    .select(
      "employee_code,nickname,first_name_en,zones,total_leads,total_crm,crm_win,total_commission,total_listings,total_matches,total_match_value"
    )
    .neq("employee_code", "C-001")
    .order("total_match_value", { ascending: false });
  return (data as SaleStatusRow[]) ?? [];
}

export async function getPotentialCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("main_10_potential_listing")
    .select("*", { count: "exact", head: true });
  return count ?? 0;
}
