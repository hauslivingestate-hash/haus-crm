// The listing's editable surface, defined ONCE.
//
// Ben, 2026-08-23: "ทำไมหน้าเพิ่มทรัพย์ กับหน้าแก้ไข ไม่เหมือนกัน" — because each screen kept
// its own hand-written list of fields. The add form was built later with only the minimum
// needed to satisfy the listing_id trigger (14 fields) while the edit sheet mirrored the
// sheet in full (44). Adding a column meant remembering to touch both, and they drifted.
//
// So both forms and both mutations now read this. A new column is added here once.
//
// NOT here, because they are not plain columns:
//   • listing_id / days_on_market / timestamps — derived
//   • project_id — a searchable picker with inline creation (main_3_property_detail)
//   • sale_id — the person creating the listing, never chosen
//   • listing_name / project_name_eng — live on the project, shared by every listing in it

export type ListingFieldKind =
  | "text"
  | "integer"
  | "numeric"
  | "date"
  | "boolean"
  | "textarea"
  | "select";

/** Permission group. `marketing` needs `listings.marketing`; `core` needs `listings.edit`. */
export type ListingFieldGroup = "core" | "marketing";

/** Which master-data list fills a select. */
export type ListingLookup =
  | "propertyTypes"
  | "zones"
  | "listingPotentials"
  | "listingStatuses"
  | "listingTypes"
  | "directions"
  | "viewTypes"
  | "unitPositions"
  | "unitConditions"
  | "inOutProjects"
  | "priceRemarks"
  | "ownerStages";

export type ListingSectionKey =
  | "basics"
  | "location"
  | "specs"
  | "pricing"
  | "owner"
  | "marketing"
  | "notes";

export interface ListingField {
  /** Column on main_4_listing_database — or on main_2_owner when `target` says so. */
  key: string;
  label: string;
  kind: ListingFieldKind;
  group: ListingFieldGroup;
  section: ListingSectionKey;
  /** Owner details live on main_2_owner and go through create_owner, not a plain update. */
  target?: "owner";
  lookup?: ListingLookup;
  /** Fixed options for a select with no master-data table behind it. */
  options?: string[];
  required?: boolean;
  placeholder?: string;
  hint?: string;
  /** Grid width inside its section. */
  span?: 1 | 2 | 3;
}

export interface ListingSection {
  key: ListingSectionKey;
  label: string;
  /** Open by default on the add form; the rest start folded so the essentials stay
   *  reachable on a phone. The edit sheet shows every section open. */
  openOnCreate: boolean;
  hint?: string;
}

export const LISTING_SECTIONS: ListingSection[] = [
  { key: "basics", label: "ข้อมูลหลัก", openOnCreate: true },
  { key: "location", label: "ทำเล", openOnCreate: false },
  { key: "specs", label: "รายละเอียดห้อง / พื้นที่", openOnCreate: false },
  {
    key: "pricing",
    label: "ประวัติราคา",
    openOnCreate: false,
    hint: "กรอกเมื่อมีการปรับราคา — ทรัพย์ใหม่ปล่อยว่างได้",
  },
  { key: "owner", label: "เจ้าของทรัพย์", openOnCreate: false },
  {
    key: "marketing",
    label: "การตลาด / ลงประกาศ",
    openOnCreate: false,
    hint: "กรอกหลังลงประกาศแล้ว",
  },
  { key: "notes", label: "หมายเหตุ", openOnCreate: false },
];

export const LISTING_FIELDS: ListingField[] = [
  // ── ข้อมูลหลัก ────────────────────────────────────────────────────────────
  // ⚠️ property_type and zone are required because the set_listing_id trigger RAISES
  // without them — the listing code is built from the type's letter plus the zone.
  { key: "property_type", label: "ประเภททรัพย์", kind: "select", group: "core", section: "basics", lookup: "propertyTypes", required: true },
  { key: "zone", label: "ทำเล / โซน", kind: "select", group: "core", section: "basics", lookup: "zones", required: true },
  { key: "listing_status", label: "สถานะประกาศ", kind: "select", group: "core", section: "basics", lookup: "listingStatuses" },
  { key: "potential", label: "Potential", kind: "select", group: "core", section: "basics", lookup: "listingPotentials" },
  { key: "listing_type", label: "ประเภทประกาศ", kind: "select", group: "core", section: "basics", lookup: "listingTypes" },
  { key: "unit_no", label: "บ้านเลขที่ / ยูนิต", kind: "text", group: "core", section: "basics" },
  { key: "bed", label: "นอน", kind: "integer", group: "core", section: "basics", span: 1 },
  { key: "bath", label: "น้ำ", kind: "numeric", group: "core", section: "basics", span: 1 },
  { key: "area_sqm", label: "ตร.ม. ใช้สอย", kind: "numeric", group: "core", section: "basics", span: 1 },
  { key: "asking_price", label: "ราคาขาย (฿)", kind: "numeric", group: "core", section: "basics" },
  { key: "rental_price", label: "ค่าเช่า / เดือน (฿)", kind: "numeric", group: "core", section: "basics" },

  // ── ทำเล ─────────────────────────────────────────────────────────────────
  { key: "in_out_project", label: "ใน/นอกโครงการ", kind: "select", group: "core", section: "location", lookup: "inOutProjects" },
  { key: "road_soi", label: "ถนน / ซอย", kind: "text", group: "core", section: "location" },
  { key: "link_location", label: "ลิงก์แผนที่", kind: "text", group: "core", section: "location", placeholder: "https://maps.google.com/…" },

  // ── รายละเอียดห้อง / พื้นที่ ────────────────────────────────────────────────
  { key: "area_rai", label: "ไร่", kind: "numeric", group: "core", section: "specs", span: 1 },
  { key: "area_ngan", label: "งาน", kind: "numeric", group: "core", section: "specs", span: 1 },
  { key: "area_wa", label: "ตร.วา", kind: "numeric", group: "core", section: "specs", span: 1 },
  { key: "floor", label: "ชั้น", kind: "text", group: "core", section: "specs", span: 1 },
  { key: "building", label: "อาคาร", kind: "text", group: "core", section: "specs", span: 1 },
  { key: "parking", label: "จอดรถ (คัน)", kind: "integer", group: "core", section: "specs", span: 1 },
  { key: "direction", label: "ทิศ", kind: "select", group: "core", section: "specs", lookup: "directions" },
  { key: "view_type", label: "วิว", kind: "select", group: "core", section: "specs", lookup: "viewTypes" },
  { key: "unit_position", label: "ตำแหน่ง", kind: "select", group: "core", section: "specs", lookup: "unitPositions" },
  { key: "unit_condition", label: "สภาพห้อง", kind: "select", group: "core", section: "specs", lookup: "unitConditions" },

  // ── ประวัติราคา ──────────────────────────────────────────────────────────
  { key: "old_price", label: "ราคาเดิม (฿)", kind: "numeric", group: "core", section: "pricing" },
  { key: "new_price", label: "ราคาใหม่ (฿)", kind: "numeric", group: "core", section: "pricing" },
  { key: "update_remark", label: "เหตุผลที่ปรับราคา", kind: "text", group: "core", section: "pricing" },
  { key: "price_remark", label: "เงื่อนไขราคา", kind: "select", group: "core", section: "pricing", lookup: "priceRemarks" },

  // ── เจ้าของ (main_2_owner) ───────────────────────────────────────────────
  { key: "owner_name", label: "ชื่อเจ้าของ", kind: "text", group: "core", section: "owner", target: "owner" },
  { key: "owner_phone", label: "เบอร์โทร", kind: "text", group: "core", section: "owner", target: "owner", placeholder: "08x-xxx-xxxx" },
  { key: "owner_line", label: "LINE", kind: "text", group: "core", section: "owner", target: "owner" },
  // Owner-side pipeline, governed in ตั้งค่า like every other lookup here.
  { key: "owner_stage", label: "ไปป์ไลน์เจ้าของ", kind: "select", group: "core", section: "owner",
    lookup: "ownerStages", hint: "ความคืบหน้ากับเจ้าของ — คนละอย่างกับสถานะประกาศ" },
  { key: "owner_focus", label: "ติดตามเจ้าของ", kind: "boolean", group: "core", section: "owner" },
  { key: "owner_talk_last_date", label: "คุยล่าสุด", kind: "date", group: "core", section: "owner" },
  { key: "activity_comment", label: "บันทึกการคุย", kind: "textarea", group: "core", section: "owner" },

  // ── การตลาด (ต้องมี listings.marketing) ─────────────────────────────────
  { key: "sign", label: "ป้าย", kind: "boolean", group: "marketing", section: "marketing" },
  { key: "vdo", label: "วิดีโอ", kind: "boolean", group: "marketing", section: "marketing" },
  { key: "ddproperty_link", label: "DDproperty", kind: "text", group: "marketing", section: "marketing" },
  { key: "livinginsider_link", label: "Livinginsider", kind: "text", group: "marketing", section: "marketing" },
  { key: "livinginsider_date", label: "วันที่ลง Livinginsider", kind: "date", group: "marketing", section: "marketing" },
  { key: "propertyhub_link", label: "PropertyHub", kind: "text", group: "marketing", section: "marketing" },
  { key: "shorts_reels_link", label: "Shorts / Reels", kind: "text", group: "marketing", section: "marketing" },
  { key: "hometour_link", label: "Hometour", kind: "text", group: "marketing", section: "marketing" },

  // ── หมายเหตุ ─────────────────────────────────────────────────────────────
  { key: "remark", label: "หมายเหตุ", kind: "textarea", group: "core", section: "notes" },
];

/** Columns that live on main_4_listing_database (i.e. not the owner's). */
export const LISTING_COLUMN_FIELDS = LISTING_FIELDS.filter((f) => f.target !== "owner");
/** The three owner details, which go through create_owner rather than a plain update. */
export const OWNER_FIELD_KEYS = LISTING_FIELDS.filter((f) => f.target === "owner").map((f) => f.key);

export function fieldsInSection(section: ListingSectionKey): ListingField[] {
  return LISTING_FIELDS.filter((f) => f.section === section);
}

/** Every field keyed for quick lookup. */
export const LISTING_FIELD_MAP: Record<string, ListingField> = Object.fromEntries(
  LISTING_FIELDS.map((f) => [f.key, f])
);

/** Blank draft — every value a string (or boolean) so both forms diff the same way. */
export function emptyListingDraft(): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const f of LISTING_FIELDS) out[f.key] = f.kind === "boolean" ? false : "";
  return out;
}
