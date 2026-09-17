/* The shape of the ทีม tab's กิจกรรมรายวัน card, and the two keys that are not categories.
 *
 * ── WHY ITS OWN FILE ────────────────────────────────────────────────────────────
 * The card is a client component (the pills hold state) and the read is in
 * lib/teamDashboard.ts, which imports the Supabase SERVER client. A client component
 * importing a value — not just a type — from that module drags `next/headers` into the
 * browser bundle and the build fails. Types are erased and would have been fine;
 * `ALL_CATEGORIES` is a real string at runtime and is not.
 *
 * So the contract lives here, with no imports at all. Same rule as lib/dashboardTabs.ts.
 * Client-safe: pure data.
 */

/** The "everything" pill. Not a row in `action_category` — it is the sum, and storing it
    would let someone file an action under the total. */
export const ALL_CATEGORIES = "__all__";

/** An action whose `category` is still unset. Kept visible rather than dropped: the work
    happened, and a grid that omits it understates the day. Matches the RPC's
    `coalesce(t.category, '')`, and the two must agree or a cell would land in ทั้งหมด
    and in no pill. */
export const NO_CATEGORY = "";

export interface HeatmapMember {
  code: string;
  nickname: string;
  avatarUrl: string | null;
  /** [day index 0 = the 1st][category] → count. `ALL_CATEGORIES` is pre-summed here so
      the grid never adds up five numbers per cell while rendering 31 × 6 of them. */
  days: Record<string, number>[];
  totals: Record<string, number>;
}

export interface ActivityHeatmap {
  /** `YYYY-MM` of the month shown. */
  monthKey: string;
  /** "ส.ค. 2026" — the month is named because it is NOT always the selected range. */
  monthLabel: string;
  daysInMonth: number;
  /** Day-of-month of today, or null when the month shown is not the current one. */
  today: number | null;
  members: HeatmapMember[];
  /** The pills, in the order ตั้งค่า puts them, with ทั้งหมด first and ไม่ระบุ appended
      only when something actually lacks a category. Comes from `action_category` — the
      card names no category itself. */
  categories: { key: string; label: string }[];
  /** The biggest single cell, per category. The colour scale is keyed to the category
      being viewed, not to the grand total: บริษัท runs an order of magnitude below
      ฝั่งผู้ซื้อ, and one shared scale would paint it uniformly blank. */
  peak: Record<string, number>;
}
