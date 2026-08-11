// Draft shape for the "Add Listing" intake form. Mirrors what main_4_listing_database
// actually accepts — numeric fields stay strings for input ergonomics and are coerced in
// lib/mutations/listings.ts.
//
// There is no `listing_name` here on purpose: main_4 has no such column. A listing's
// displayed name is its project's Thai name, joined through v_main_listing, so `project_id`
// is what gives a listing a name at all — a listing filed without one reads as blank on
// every screen.

export interface NewListing {
  /** FK to main_3_property_detail. Empty = the listing would show with no name. */
  project_id: string;
  /** Label of the picked project, kept only so the combobox can render its own selection. */
  project_label: string;
  property_type: string;
  zone_id: string;
  unit_no: string;
  bed: string;
  bath: string;
  area_sqm: string;
  asking_price: string;
  rental_price: string;
  potential: string;
  listing_status: string;
  /** employee_code (main_1_hr), NOT a nickname — sale_id is a foreign key. */
  agent_id: string;
  owner_name: string;
  owner_phone: string;
  remark: string;
}

// Statuses meaningful for a brand-new listing. The terminal states (Sold/Cancel + their
// *Completed variants in lib/status) are reached later in the lifecycle, not set at intake.
// All four exist in the `listing_status` lookup, which the column FKs to.
export const NEW_LISTING_STATUSES = ["Ready to Post", "Posted", "Need Info", "Update"];

export function emptyListing(): NewListing {
  return {
    project_id: "",
    project_label: "",
    property_type: "",
    zone_id: "",
    unit_no: "",
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
