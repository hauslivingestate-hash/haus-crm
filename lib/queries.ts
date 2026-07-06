import { supabase } from "./supabase";

export interface CrmRow {
  lead_id: string;
  lead_name: string | null;
  phone: string | null;
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

export interface ListingRow {
  listing_id: string;
  listing_name: string | null;
  project_name_eng: string | null;
  zone: string | null;
  zone_name_thai: string | null;
  listing_status: string | null;
  potential: string | null;
  listing_type: string | null;
  property_type: string | null;
  bed: number | null;
  bath: number | null;
  area_sqm: number | null;
  asking_price: number | null;
  rental_price: number | null;
  owner_name: string | null;
  owner_phone: string | null;
  days_on_market: number | null;
}

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
  const { data } = await supabase
    .from("main_6_buyer_crm")
    .select(
      "lead_id,lead_name,phone,potential,lead_status,pipeline_stage,lead_type,sale_id,listing_code,budget,commission,last_follow_date,closing_date,date_received"
    )
    .order("date_received", { ascending: false });
  return (data as CrmRow[]) ?? [];
}

export async function getListings(): Promise<ListingRow[]> {
  const { data } = await supabase
    .from("v_main_listing")
    .select(
      "listing_id,listing_name,project_name_eng,zone,zone_name_thai,listing_status,potential,listing_type,property_type,bed,bath,area_sqm,asking_price,rental_price,owner_name,owner_phone,days_on_market"
    )
    .order("listing_id");
  return (data as ListingRow[]) ?? [];
}

export async function getSaleStatus(): Promise<SaleStatusRow[]> {
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
  const { count } = await supabase
    .from("main_10_potential_listing")
    .select("*", { count: "exact", head: true });
  return count ?? 0;
}
