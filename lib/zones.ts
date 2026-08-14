// Zones — types only. Phase 6 replaced the sample list with the real `zone` table (read in
// lib/queries.ts, written in lib/mutations/zones.ts).
//
// The sample it replaced was actively harmful, not merely stale: it carried 12 zones where
// the DB has 30, FOUR of its codes (PTM, PT3, BKL, BWK) do not exist in `zone` at all, and
// its owner column disagreed with `zone_sales` on most rows. It was still feeding the zone
// dropdown in ListingEditSheet, so picking one of those four failed the FK on save.
//
// ⚠️ ONE ZONE HAS MANY AGENTS. `zone.sale_id_assigned` was dropped on 2026-08-03 in favour
// of `zone_sales(zone_id, employee_code, is_primary)` — พระราม 3 really is Mhow + Pup. The
// single `sale_id_assigned` field this file used to expose could not represent that.

/** One agent's link to a zone. */
export interface ZoneSale {
  code: string; // employee_code
  nickname: string;
  /** เจ้าภาพโซน — at most one per zone (partial unique index). Used as the fallback owner
   *  for a lead with no listing, and for a new listing with no agent yet
   *  (`zone_primary_sale()` → `v_main_listing.effective_sale_id`). */
  isPrimary: boolean;
}

export interface Zone {
  zone_id: string; // short code, e.g. "CYP" — part of every listing_id, never renamed
  name_eng: string;
  name_thai: string;
  sales: ZoneSale[];
  /** Listings currently in this zone — the impact line on delete. */
  listingCount: number;
}

/** The zone's เจ้าภาพ, if one is set. */
export function primarySale(z: Zone): ZoneSale | undefined {
  return z.sales.find((s) => s.isPrimary);
}

/**
 * Is `code` safe to add as a new zone id?
 *
 * ⚠️ A listing id is `<property type><zone_id><running number>` with NO separator, so a
 * code that is a prefix of another (or vice-versa) makes ids ambiguous — "CRP" + "1001"
 * and "CRP1" + "001" read identically. Checked here rather than in the DB because it is a
 * rule about how ids are composed, not about the row.
 */
export function zoneCodeConflict(code: string, existing: string[]): string | null {
  const c = code.trim().toUpperCase();
  if (!c) return "ต้องใส่รหัสโซน";
  if (!/^[A-Z0-9]+$/.test(c)) return "รหัสโซนใช้ได้เฉพาะ A-Z และ 0-9";
  for (const e of existing) {
    const u = e.toUpperCase();
    if (u === c) return `รหัส ${c} มีอยู่แล้ว`;
    if (u.startsWith(c) || c.startsWith(u)) {
      return `รหัส ${c} ชนกับ ${e} — รหัสโซนห้ามเป็นคำนำหน้าของอีกโซน (รหัสทรัพย์จะซ้ำกัน)`;
    }
  }
  return null;
}
