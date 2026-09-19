// Rules of the Support desk, shared by the page and the server actions. Client-safe: no
// Supabase import. See lib/support.ts for the queue itself.

/** Status → what finishing the job moves it to. The keys ARE the queue. */
export const QUEUE_NEXT: Record<string, string> = {
  "Ready to Post": "Posted",
  Update: "Posted",
  Sold: "Sold Completed",
  Cancel: "Cancel Completed",
};

export type PortalKey = "ddproperty_link" | "livinginsider_link" | "propertyhub_link";

export const PORTALS: { key: PortalKey; label: string; host: string; required: boolean }[] = [
  { key: "livinginsider_link", label: "Livinginsider", host: "livinginsider", required: true },
  { key: "propertyhub_link", label: "PropertyHub", host: "propertyhub", required: true },
  // Optional (Ben, 2026-09-19): the minimum to call a listing posted is Livinginsider +
  // PropertyHub. DDproperty costs credits, so not every listing goes there.
  { key: "ddproperty_link", label: "DDproperty", host: "ddproperty", required: false },
];

/**
 * Why a pasted link is wrong, or null when it is fine. Catches the two mistakes that are
 * easy to make with three near-identical boxes: text that is not a link, and a link pasted
 * into another portal's box.
 */
export function portalLinkProblem(key: PortalKey, value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const portal = PORTALS.find((p) => p.key === key)!;
  if (!/^https?:\/\//i.test(v)) return `${portal.label}: ต้องเป็นลิงก์ที่ขึ้นต้นด้วย https://`;
  const other = PORTALS.find((p) => p.key !== key && v.toLowerCase().includes(p.host));
  if (other) return `${portal.label}: ลิงก์นี้เป็นของ ${other.label} — วางผิดช่อง`;
  return null;
}

export function isUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value.trim());
}

// ── Facebook Post board ──────────────────────────────────────────────────────

/** Facebook-group re-post cadence (days), and the number of post links kept per listing. */
export const FB_GROUP_DAYS = 6;
export const FB_GROUP_SLOTS = 5;
/** An Exclusive's pinned post turns red after this many days (Ben, 2026-09-19). */
export const PIN_ALERT_DAYS = 85;

/** checklist_template_item.board_key values the board reads. */
export type BoardKey = "template_link" | "marketplace" | "profile" | "page" | "fb_group";

export interface FbBoardRow {
  listingId: string;
  projectName: string | null;
  price: number | null;
  potential: string | null;
  tier: "exclusive" | "a_list";
  saleCode: string | null;
  saleName: string | null;
  agreementStart: string | null;
  agreementEnd: string | null;
  pinnedOn: string | null;
  templateLink: string | null;
  marketplace: boolean;
  profile: boolean;
  page: boolean;
  groupPosts: { slot: number; url: string; postedOn: string }[];
  lastGroupPost: string | null;
  /** Never posted, or the last post is older than FB_GROUP_DAYS. */
  groupOverdue: boolean;
}
