// Draft shape for the "Add Listing" intake form (design-first). Mirrors the create-side of
// v_main_listing. Numeric fields are kept as strings for input ergonomics; they'd be coerced
// at the wire-later write. Wire later = an insert into the base listing table (the app reads
// the read-only v_main_listing view today, so creation is a STUB — see ListingForm).

export interface NewListing {
  listing_name: string;
  property_type: string;
  project_name: string;
  zone_id: string;
  bed: string;
  bath: string;
  area_sqm: string;
  asking_price: string;
  rental_price: string;
  potential: string;
  listing_status: string;
  agent_id: string; // managing agent (rbac / employee id)
  owner_name: string;
  owner_phone: string;
  remark: string;
}

// Statuses meaningful for a brand-new listing. The terminal states (Sold/Cancel + their
// *Completed variants in lib/status) are reached later in the lifecycle, not set at intake.
export const NEW_LISTING_STATUSES = ["Ready to Post", "Posted", "Need Info", "Update"];

export function emptyListing(): NewListing {
  return {
    listing_name: "",
    property_type: "",
    project_name: "",
    zone_id: "",
    bed: "",
    bath: "",
    area_sqm: "",
    asking_price: "",
    rental_price: "",
    potential: "Normal",
    listing_status: "Ready to Post",
    agent_id: "",
    owner_name: "",
    owner_phone: "",
    remark: "",
  };
}
