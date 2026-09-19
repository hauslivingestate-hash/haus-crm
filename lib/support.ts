import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { LISTING_COLUMNS, getStaffDirectory, type ListingRow } from "@/lib/queries";
import { daysSince } from "@/lib/checklists";
import { QUEUE_NEXT, FB_GROUP_DAYS, type BoardKey, type FbBoardRow } from "@/lib/supportRules";

// โต๊ะงาน Support (/support/*) — Listing Support's day, as Ben described it on 2026-09-19:
//
//   ลงประกาศใหม่   a sale sets a listing to "Ready to Post" → Support posts it on the portals,
//                  pastes the links back, and it becomes "Posted".
//   อัปเดตประกาศ   a sale sets "Update" / "Sold" / "Cancel" → Support edits or takes the advert
//                  down, and the status moves on (Posted / … Completed).
//   Facebook Post  live (Posted) A-List / Exclusive listings: template link, Marketplace /
//                  Profile / Page ticks, five Facebook-group links re-posted every 6 days —
//                  and for Exclusive the agreement and pin dates.
//
// Each is its own page and its own sidebar entry with a count of work waiting. The counts
// (getSupportCounts) and the pages (getSupportQueue / getFbBoard) apply the same rules, so a
// badge never disagrees with the page it points at.
//
// ⚠️ The queues are only as good as the statuses. Until sales change status in the web app
// (they still do it in the sheet), the first two stay empty — see CLAUDE.md 2026-09-19.

const UPDATE_STATUSES = Object.keys(QUEUE_NEXT).filter((s) => s !== "Ready to Post");

export const getSupportStaff = cache(async (): Promise<Record<string, string>> => {
  const staff = await getStaffDirectory();
  return Object.fromEntries(staff.map((s) => [s.code, s.nickname]));
});

/** ลงประกาศใหม่ ("new") or อัปเดตประกาศ ("update"), oldest waiting first. */
export async function getSupportQueue(kind: "new" | "update"): Promise<ListingRow[]> {
  const supabase = await createClient();
  const statuses = kind === "new" ? ["Ready to Post"] : UPDATE_STATUSES;
  const { data, error } = await supabase
    .from("v_main_listing")
    .select(LISTING_COLUMNS)
    .in("listing_status", statuses)
    .order("updated_at", { ascending: true });
  if (error) throw new Error(`getSupportQueue: ${error.message}`);
  return (data ?? []) as unknown as ListingRow[];
}

/* ── Facebook Post ─────────────────────────────────────────────────────────────
   Live (Posted) A-List and Exclusive listings. Ben, 2026-09-19: only potential exactly
   "Exclusive" is Exclusive here — "Exclusive A" and "A List + Fb add" both sit with A-List.
   (That is narrower than potentialGroup(), which the checklist cards use.)

   The tick/link columns are checklist steps, found by `board_key` rather than by label so
   renaming a step in Settings does not break the board. */

const BOARD_KEYS: BoardKey[] = ["template_link", "marketplace", "profile", "page", "fb_group"];

type StepRow = {
  listing_id: string;
  template_item_id: number;
  completed_at: string | null;
  due_date: string | null;
  url: string | null;
};

type LiveRow = {
  listing_id: string;
  listing_name: string | null;
  asking_price: number | null;
  potential: string | null;
  effective_sale_id: string | null;
  agreement_start: string | null;
  agreement_end: string | null;
};

export const getFbBoard = cache(
  async (): Promise<{ rows: FbBoardRow[]; itemIds: Partial<Record<BoardKey, number>> }> => {
    const supabase = await createClient();
    const [liveRes, pinRes, itemsRes, postsRes, staff] = await Promise.all([
      supabase
        .from("v_main_listing")
        .select("listing_id, listing_name, asking_price, potential, effective_sale_id, agreement_start, agreement_end")
        .eq("listing_status", "Posted")
        .not("potential", "is", null)
        .neq("potential", "Normal"),
      supabase
        .from("main_4_listing_database")
        .select("listing_id, fb_pinned_on")
        .eq("listing_status", "Posted")
        .not("fb_pinned_on", "is", null),
      supabase.from("checklist_template_item").select("id, board_key").in("board_key", BOARD_KEYS),
      supabase.from("listing_fb_group_post").select("listing_id, slot, url, posted_on"),
      getSupportStaff(),
    ]);
    for (const r of [liveRes, pinRes, itemsRes, postsRes]) {
      if (r.error) throw new Error(`getFbBoard: ${r.error.message}`);
    }

    const itemIds: Partial<Record<BoardKey, number>> = {};
    for (const i of (itemsRes.data ?? []) as { id: number; board_key: BoardKey }[]) itemIds[i.board_key] = i.id;

    const progress = new Map<string, StepRow>();
    const ids = Object.values(itemIds);
    if (ids.length) {
      const { data, error } = await supabase
        .from("listing_checklist_item")
        .select("listing_id, template_item_id, completed_at, due_date, url")
        .in("template_item_id", ids);
      if (error) throw new Error(`getFbBoard progress: ${error.message}`);
      for (const r of (data ?? []) as StepRow[]) progress.set(`${r.listing_id}|${r.template_item_id}`, r);
    }
    const step = (listingId: string, key: BoardKey) => {
      const id = itemIds[key];
      return id == null ? undefined : progress.get(`${listingId}|${id}`);
    };

    const pins = new Map(
      ((pinRes.data ?? []) as { listing_id: string; fb_pinned_on: string }[]).map((r) => [r.listing_id, r.fb_pinned_on])
    );
    const posts = new Map<string, { slot: number; url: string; postedOn: string }[]>();
    for (const p of (postsRes.data ?? []) as { listing_id: string; slot: number; url: string; posted_on: string }[]) {
      const list = posts.get(p.listing_id) ?? [];
      list.push({ slot: p.slot, url: p.url, postedOn: p.posted_on });
      posts.set(p.listing_id, list);
    }

    const rows: FbBoardRow[] = ((liveRes.data ?? []) as LiveRow[]).map((l) => {
      const group = (posts.get(l.listing_id) ?? []).sort((a, b) => a.slot - b.slot);
      const last = group.reduce<string | null>((m, p) => (m == null || p.postedOn > m ? p.postedOn : m), null);
      return {
        listingId: l.listing_id,
        projectName: l.listing_name,
        price: l.asking_price,
        potential: l.potential,
        tier: l.potential === "Exclusive" ? "exclusive" : "a_list",
        saleCode: l.effective_sale_id,
        saleName: l.effective_sale_id ? staff[l.effective_sale_id] ?? l.effective_sale_id : null,
        agreementStart: l.agreement_start,
        agreementEnd: l.agreement_end,
        pinnedOn: pins.get(l.listing_id) ?? null,
        templateLink: step(l.listing_id, "template_link")?.url ?? null,
        marketplace: !!step(l.listing_id, "marketplace")?.completed_at,
        profile: !!step(l.listing_id, "profile")?.completed_at,
        page: !!step(l.listing_id, "page")?.completed_at,
        groupPosts: group,
        lastGroupPost: last,
        groupOverdue: last == null || daysSince(last) > FB_GROUP_DAYS,
      };
    });

    // Exclusive first, then by sale, then by listing.
    rows.sort(
      (a, b) =>
        (a.tier === b.tier ? 0 : a.tier === "exclusive" ? -1 : 1) ||
        (a.saleName ?? "~").localeCompare(b.saleName ?? "~") ||
        a.listingId.localeCompare(b.listingId)
    );
    return { rows, itemIds };
  }
);

/** The sidebar badges — work waiting on each Support page. */
export async function getSupportCounts(): Promise<{ new: number; update: number; facebook: number }> {
  const supabase = await createClient();
  const count = (statuses: string[]) =>
    supabase
      .from("main_4_listing_database")
      .select("listing_id", { count: "exact", head: true })
      .in("listing_status", statuses);
  const [n, u, fb] = await Promise.all([count(["Ready to Post"]), count(UPDATE_STATUSES), getFbBoard()]);
  return {
    new: n.count ?? 0,
    update: u.count ?? 0,
    facebook: fb.rows.filter((r) => r.groupOverdue).length,
  };
}
