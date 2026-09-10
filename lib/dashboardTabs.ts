/* Which dashboards a person can open.
 *
 * The company runs several jobs off one screen — a sale reads their own numbers, a
 * leader reads the team's, listing support reads the inventory. One layout cannot serve
 * all three without becoming a page of cards most viewers have no use for. So the
 * dashboard is TABBED, and the tabs a viewer gets are the ones their permissions admit.
 *
 * ── KEYED ON PERMISSIONS, NEVER ON ROLE NAMES ───────────────────────────────────
 * Roles are editable data (ตั้งค่า ▸ บทบาท), including their names. A tab gated on
 * `role === "Agent (Sales)"` would vanish the day someone renames it, and could not be
 * granted to a second role without a code change. Permissions are the stable
 * vocabulary — the same one the sidebar (lib/nav.ts) and every RLS policy use.
 *
 * ── ONE TAB MEANS NO TAB BAR ────────────────────────────────────────────────────
 * A tab strip with a single tab is furniture that explains nothing. Sales see the
 * sales dashboard with no chrome at all; the strip appears for whoever qualifies for
 * more than one.
 *
 * Client-safe: pure data, no Supabase import.
 */

export interface DashboardTab {
  /** URL value — `/?tab=sales`. */
  id: string;
  label: string;
  /** ANY one of these is enough to see the tab. Empty = everyone. */
  perms: string[];
}

/* Only tabs that are BUILT belong here. A tab that renders an empty shell reads as a
   broken page, not as a promise — the ones still to come (ทีม on
   `performance.view_team`, ทรัพย์ on `listings.marketing`, การตลาด on
   `website.manage`) go in as they ship, one line each. */
export const DASHBOARD_TABS: DashboardTab[] = [
  {
    id: "sales",
    label: "ขาย",
    // The sale's own scoreboard. `performance.view_own` is the permission that already
    // means "may see their own numbers" — the same gate แผนวันนี้ sits behind.
    perms: ["performance.view_own", "performance.view_team"],
  },
];

/** The tabs this permission set admits, in registry order. */
export function visibleTabs(permissions: readonly string[]): DashboardTab[] {
  const held = new Set(permissions);
  return DASHBOARD_TABS.filter((t) => t.perms.length === 0 || t.perms.some((p) => held.has(p)));
}

/**
 * Which tab to render.
 *
 * A `?tab=` the viewer may not open falls back to their first tab rather than erroring:
 * it is what a stale bookmark or a link pasted between two people with different roles
 * looks like, and neither is an error the reader can act on. Returns null only when the
 * viewer qualifies for no dashboard at all.
 */
export function resolveTab(requested: string | undefined, visible: DashboardTab[]): DashboardTab | null {
  if (!visible.length) return null;
  return visible.find((t) => t.id === requested) ?? visible[0];
}
