"use server";

/* The list behind one ความเคลื่อนไหว bar. See lib/movementDrill.ts for the types and why
 * this loads on tap rather than with the page.
 *
 * ── IT RESOLVES ITS OWN RANGE FROM THE SAME PARAMS THE PAGE DID ─────────────────
 * The caller passes the URL search params, not a start/end pair. If the modal took dates
 * it would be possible — through a stale closure, a back button, a slow render — for the
 * list to describe a different window than the bar that opened it, and nothing on screen
 * would say so. Re-resolving from the params makes that impossible.
 *
 * ── ALWAYS THE SIGNED-IN PERSON ─────────────────────────────────────────────────
 * There is no employeeCode parameter, deliberately. This card is a personal scoreboard;
 * accepting a code would turn a drill-down into a way to read somebody else's day, and
 * RLS admits `performance.view_team`, so it would not be refused.
 */

import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import { resolveRange } from "@/lib/range";
import type { DrillCase, DrillTarget } from "@/lib/movementDrill";

/** Enough rows to answer "which ones", not a data export. A month of Follow can run to
    hundreds; the card's number is the count, this is the evidence. */
const LIMIT = 200;

export async function fetchMovementCases(
  params: { range?: string; from?: string; to?: string },
  target: DrillTarget
): Promise<DrillCase[]> {
  const auth = await getAuthContext();
  if (!auth?.employeeCode) return [];
  const employeeCode = auth.employeeCode;
  const range = resolveRange(params);
  const supabase = await createClient();

  if (target.of === "ownerStage" && target.view === "funnel") {
    const { data } = await supabase.rpc("dash_owner_funnel_listings", {
      p_sale_id: employeeCode,
      p_from: range.start,
      p_to: range.end,
      p_stage: target.stage,
    });
    return listingRows(supabase, data as ListingRow[] | null);
  }

  if (target.of === "stage" && target.view === "funnel") {
    const { data } = await supabase.rpc("dash_funnel_leads", {
      p_sale_id: employeeCode,
      p_from: range.start,
      p_to: range.end,
      p_stage: target.stage,
    });
    return ((data ?? []) as {
      lead_id: string;
      lead_name: string | null;
      pipeline_stage: string | null;
      date_received: string | null;
    }[])
      .slice(0, LIMIT)
      .map((r) => ({
        side: "lead" as const,
        id: r.lead_id,
        name: r.lead_name || r.lead_id,
        date: r.date_received,
        detail: r.pipeline_stage,
      }));
  }

  /* ---- the two activity drills ------------------------------------------------- */

  // A step row sums every action that advances it, so the drill has to ask the same
  // question the count did: which actions point at this step. Reading `action_type`
  // rather than hard-coding the mapping is the whole reason the two stage columns exist.
  let actions: string[];
  if (target.of === "action") {
    actions = [target.name];
  } else {
    const column = target.of === "ownerStage" ? "owner_stage_name" : "stage_name";
    const { data } = await supabase.from("action_type").select("name").eq(column, target.stage);
    actions = ((data ?? []) as { name: string }[]).map((a) => a.name);
    // A step with no action behind it draws greyed and does not open; reaching here with
    // an empty list would mean an unfiltered query returning the person's whole month.
    if (actions.length === 0) return [];
  }

  const { data: rows } = await supabase
    .from("activities")
    .select("id,action,activity_date,remark,related_lead_id,related_listing_id")
    .eq("employee_code", employeeCode)
    .in("action", actions)
    .gte("activity_date", range.start)
    .lte("activity_date", range.end)
    .order("activity_date", { ascending: false })
    .limit(LIMIT);

  const acts = (rows ?? []) as {
    id: number;
    action: string;
    activity_date: string;
    remark: string | null;
    related_lead_id: string | null;
    related_listing_id: string | null;
  }[];
  if (acts.length === 0) return [];

  // Names in one round trip each, not one per row.
  const leadIds = [...new Set(acts.map((a) => a.related_lead_id).filter(Boolean))] as string[];
  const listingIds = [...new Set(acts.map((a) => a.related_listing_id).filter(Boolean))] as string[];
  const [leads, listings] = await Promise.all([
    leadIds.length
      ? supabase.from("main_6_buyer_crm").select("lead_id,lead_name").in("lead_id", leadIds)
      : Promise.resolve({ data: [] }),
    listingIds.length
      ? supabase.from("v_main_listing").select("listing_id,listing_name").in("listing_id", listingIds)
      : Promise.resolve({ data: [] }),
  ]);
  const leadName = new Map(
    ((leads.data ?? []) as { lead_id: string; lead_name: string | null }[]).map((l) => [l.lead_id, l.lead_name])
  );
  const listingName = new Map(
    ((listings.data ?? []) as { listing_id: string; listing_name: string | null }[]).map((l) => [
      l.listing_id,
      l.listing_name,
    ])
  );

  return acts.map((a) => {
    // An activity attached to nothing is real work (ประชุม, Sourcing) and must still be
    // listed. It shows under its own action name with no link target — `side` still says
    // "lead" so the row renders, but there is no id to open, which the UI checks.
    const listingId = a.related_listing_id;
    const leadId = a.related_lead_id;
    if (listingId) {
      return {
        side: "listing" as const,
        id: listingId,
        name: listingName.get(listingId) || listingId,
        date: a.activity_date,
        kind: a.action,
        detail: a.remark,
      };
    }
    return {
      side: "lead" as const,
      id: leadId ?? "",
      name: leadId ? leadName.get(leadId) || leadId : "(ไม่ได้ผูกกับลีดหรือทรัพย์)",
      date: a.activity_date,
      kind: a.action,
      detail: a.remark,
    };
  });
}

interface ListingRow {
  listing_id: string;
  owner_stage: string | null;
  date_created: string | null;
}

async function listingRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  data: ListingRow[] | null
): Promise<DrillCase[]> {
  const rows = (data ?? []).slice(0, LIMIT);
  if (rows.length === 0) return [];
  const { data: named } = await supabase
    .from("v_main_listing")
    .select("listing_id,listing_name")
    .in(
      "listing_id",
      rows.map((r) => r.listing_id)
    );
  const name = new Map(
    ((named ?? []) as { listing_id: string; listing_name: string | null }[]).map((l) => [
      l.listing_id,
      l.listing_name,
    ])
  );
  return rows.map((r) => ({
    side: "listing" as const,
    id: r.listing_id,
    name: name.get(r.listing_id) || r.listing_id,
    date: r.date_created,
    detail: r.owner_stage,
  }));
}
