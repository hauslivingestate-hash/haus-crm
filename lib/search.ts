"use server";

import { createClient } from "@/lib/supabase/server";

// Listing lookup for the intake form's "ทรัพย์ที่สนใจ" combobox. A server action rather than
// shipping the inventory to the client: there are 511 listings and the picker is only used by
// the few roles holding leads.create.
//
// `effective_sale_id` is what makes the assignment default work — it is the listing's own
// agent, falling back to the zone's primary agent. That mirrors the rule the rest of the app
// follows: the LISTING decides who handles the lead, not the zone.

export interface ListingHit {
  code: string;
  label: string;
  sale: string | null;
}

export interface ProjectHit {
  projectId: string;
  label: string;
}

/**
 * Project lookup for the listing intake form.
 *
 * This picker is not a convenience: `main_4_listing_database` has no `listing_name` column,
 * and `v_main_listing.listing_name` is the joined `main_3_property_detail.project_name_thai`.
 * The project a listing points at IS its displayed name everywhere, so a listing filed
 * without one shows up blank on every screen.
 */
export async function searchProjects(query: string): Promise<ProjectHit[]> {
  const q = query.trim();
  const supabase = await createClient();

  let req = supabase
    .from("main_3_property_detail")
    .select("project_id,project_name_thai,project_name_eng")
    .order("project_name_thai")
    .limit(8);

  if (q) {
    // Sheet data put Thai names in the English column often enough that searching only one
    // would hide real projects — match either.
    const safe = q.replace(/[(),]/g, " ");
    req = req.or(`project_name_thai.ilike.%${safe}%,project_name_eng.ilike.%${safe}%`);
  }

  const { data } = await req;
  return ((data ?? []) as {
    project_id: string;
    project_name_thai: string | null;
    project_name_eng: string | null;
  }[]).map((p) => ({
    projectId: p.project_id,
    label: p.project_name_thai || p.project_name_eng || p.project_id,
  }));
}

export interface LeadHit {
  id: string;
  label: string;
}

/**
 * Lead lookup for the Daily Plan's "เชื่อมกับ CRM" picker.
 *
 * `tasks.related_lead_id` and `activities.related_lead_id` are both FKs to
 * `main_6_buyer_crm`, so the design build's six hardcoded sample leads (L-0007, L-0011 …)
 * would fail every insert. RLS scopes the result to the leads the caller may see, which for
 * an agent is their own — exactly the set they can plan work against.
 */
export async function searchLeads(query: string): Promise<LeadHit[]> {
  const q = query.trim();
  const supabase = await createClient();

  let req = supabase
    .from("main_6_buyer_crm")
    .select("lead_id,lead_name,phone")
    .order("lead_id", { ascending: false })
    .limit(8);

  if (q) {
    const safe = q.replace(/[(),]/g, " ");
    req = req.or(`lead_id.ilike.%${safe}%,lead_name.ilike.%${safe}%,phone.ilike.%${safe}%`);
  }

  const { data } = await req;
  return ((data ?? []) as { lead_id: string; lead_name: string | null; phone: string | null }[]).map(
    (l) => ({
      id: l.lead_id,
      label: [l.lead_name || l.lead_id, l.phone].filter(Boolean).join(" · "),
    })
  );
}

export async function searchListings(query: string): Promise<ListingHit[]> {
  const q = query.trim();
  const supabase = await createClient();

  let req = supabase
    .from("v_main_listing")
    .select("listing_id,listing_name,zone_name_thai,effective_sale_id")
    .order("listing_id")
    .limit(8);

  if (q) {
    // Match either the code or the project name; PostgREST needs the OR as one filter string.
    const safe = q.replace(/[(),]/g, " ");
    req = req.or(`listing_id.ilike.%${safe}%,listing_name.ilike.%${safe}%`);
  }

  const { data } = await req;
  return ((data ?? []) as {
    listing_id: string;
    listing_name: string | null;
    zone_name_thai: string | null;
    effective_sale_id: string | null;
  }[]).map((l) => ({
    code: l.listing_id,
    label: [l.listing_name, l.zone_name_thai].filter(Boolean).join(" · ") || l.listing_id,
    sale: l.effective_sale_id,
  }));
}
