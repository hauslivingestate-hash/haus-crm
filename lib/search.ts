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
