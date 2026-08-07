"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";

// First write path in the app (Phase 5 #1) — see the plan this followed for the full design
// rationale. Every Phase 5 mutation after this one should copy this shape: resolve identity
// server-side, re-fetch the current row (never trust the client's idea of "before"), filter
// the patch by both field existence AND permission, diff before writing, audit what actually
// changed, revalidate.

type FieldType = "text" | "integer" | "numeric" | "boolean" | "date";
type FieldGroup = "core" | "marketing";

// `project_name_eng` is deliberately absent: it lives on main_3_property_detail (shared by
// every listing in the project), not on this row, so it is never writable from here regardless
// of what a caller sends.
const LISTING_FIELDS: Record<string, { type: FieldType; group: FieldGroup }> = {
  listing_name: { type: "text", group: "core" },
  listing_status: { type: "text", group: "core" },
  potential: { type: "text", group: "core" },
  listing_type: { type: "text", group: "core" },
  owner_focus: { type: "boolean", group: "core" },
  zone: { type: "text", group: "core" },
  in_out_project: { type: "text", group: "core" },
  road_soi: { type: "text", group: "core" },
  link_location: { type: "text", group: "core" },
  property_type: { type: "text", group: "core" },
  unit_no: { type: "text", group: "core" },
  bed: { type: "integer", group: "core" },
  bath: { type: "numeric", group: "core" },
  area_rai: { type: "numeric", group: "core" },
  area_ngan: { type: "numeric", group: "core" },
  area_wa: { type: "numeric", group: "core" },
  area_sqm: { type: "numeric", group: "core" },
  floor: { type: "text", group: "core" },
  building: { type: "text", group: "core" },
  direction: { type: "text", group: "core" },
  view_type: { type: "text", group: "core" },
  unit_position: { type: "text", group: "core" },
  parking: { type: "integer", group: "core" },
  unit_condition: { type: "text", group: "core" },
  asking_price: { type: "numeric", group: "core" },
  rental_price: { type: "numeric", group: "core" },
  old_price: { type: "numeric", group: "core" },
  new_price: { type: "numeric", group: "core" },
  update_remark: { type: "text", group: "core" },
  price_remark: { type: "text", group: "core" },
  owner_talk_last_date: { type: "date", group: "core" },
  activity_comment: { type: "text", group: "core" },
  remark: { type: "text", group: "core" },
  sign: { type: "boolean", group: "marketing" },
  vdo: { type: "boolean", group: "marketing" },
  ddproperty_link: { type: "text", group: "marketing" },
  livinginsider_link: { type: "text", group: "marketing" },
  livinginsider_date: { type: "date", group: "marketing" },
  propertyhub_link: { type: "text", group: "marketing" },
  shorts_reels_link: { type: "text", group: "marketing" },
  hometour_link: { type: "text", group: "marketing" },
};

const OWNER_FIELDS = ["owner_name", "owner_phone", "owner_line"] as const;

type Patch = Record<string, string | boolean | null>;
type Row = Record<string, unknown>;

function coerce(type: FieldType, value: string | boolean | null): unknown {
  if (type === "boolean") return !!value;
  if (value === "" || value == null) return null;
  if (type === "integer") {
    const n = parseInt(String(value), 10);
    return Number.isFinite(n) ? n : null;
  }
  if (type === "numeric") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return value; // text / date — dates arrive as "YYYY-MM-DD" already
}

/** Only the keys that actually differ from the current row, after coercion. */
function diff(current: Row, submitted: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(submitted)) {
    if ((current[k] ?? null) !== (v ?? null)) out[k] = v;
  }
  return out;
}

async function writeAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  changedBy: string,
  entity: string,
  entityId: string,
  action: "insert" | "update",
  before: Row | null,
  after: Row
) {
  await supabase.from("audit_log").insert({
    entity,
    entity_id: entityId,
    action,
    changed_by: changedBy,
    before,
    after,
  });
}

export async function updateListing(
  listingId: string,
  rawPatch: Patch
): Promise<{ ok: true; unchanged?: boolean } | { ok: false; error: string }> {
  const auth = await getAuthContext();
  if (!auth?.employeeCode) {
    return { ok: false, error: "ไม่พบสิทธิ์ผู้ใช้ กรุณาเข้าสู่ระบบใหม่" };
  }
  const perms = new Set(auth.permissions);
  const canEdit = perms.has("listings.edit") || perms.has("roles.manage");
  const canMarketing = canEdit || perms.has("listings.marketing");
  if (!canEdit && !canMarketing) {
    return { ok: false, error: "ไม่มีสิทธิ์แก้ไขทรัพย์" };
  }

  const supabase = await createClient();

  const { data: current, error: fetchError } = await supabase
    .from("main_4_listing_database")
    .select("*")
    .eq("listing_id", listingId)
    .maybeSingle();
  if (fetchError || !current) {
    return { ok: false, error: fetchError?.message ?? "ไม่พบทรัพย์นี้" };
  }

  // Filter to known fields the caller's permissions allow, coerce, then keep only real diffs.
  const submitted: Row = {};
  for (const [key, value] of Object.entries(rawPatch)) {
    const spec = LISTING_FIELDS[key];
    if (!spec) continue;
    if (spec.group === "core" && !canEdit) continue;
    if (spec.group === "marketing" && !canMarketing) continue;
    submitted[key] = coerce(spec.type, value);
  }
  const corePatch = diff(current, submitted);

  // Owner (main_2_owner) — only reachable with canEdit, matching the table's RLS.
  let ownerAudit: { action: "insert" | "update"; entityId: string; before: Row | null; after: Row } | null = null;
  if (canEdit) {
    const ownerSubmitted: Row = {};
    for (const key of OWNER_FIELDS) {
      if (key in rawPatch) {
        const v = rawPatch[key];
        ownerSubmitted[key] = v === "" || v == null ? null : v;
      }
    }

    if (current.owner_id != null) {
      if (Object.keys(ownerSubmitted).length > 0) {
        const { data: currentOwner } = await supabase
          .from("main_2_owner")
          .select("owner_name,owner_phone,owner_line")
          .eq("owner_id", current.owner_id)
          .maybeSingle();
        const ownerDiff = diff(currentOwner ?? {}, ownerSubmitted);
        if (Object.keys(ownerDiff).length > 0) {
          const { error: ownerUpdateError } = await supabase
            .from("main_2_owner")
            .update(ownerDiff)
            .eq("owner_id", current.owner_id);
          if (ownerUpdateError) return { ok: false, error: ownerUpdateError.message };
          ownerAudit = {
            action: "update",
            entityId: String(current.owner_id),
            before: currentOwner ?? null,
            after: ownerDiff,
          };
        }
      }
    } else if (Object.values(ownerSubmitted).some((v) => v != null)) {
      // A plain `.insert().select()` here is `INSERT ... RETURNING`, which Postgres also
      // checks against the SELECT policy — and a brand-new owner isn't visible under it yet
      // (that policy scopes visibility to owners already linked to a listing the caller
      // manages, which this row isn't until the UPDATE below runs). `create_owner` is a
      // SECURITY DEFINER RPC that does the same authorization check as the INSERT policy
      // but sidesteps that RETURNING/SELECT conflict.
      const { data: newOwnerId, error: ownerInsertError } = await supabase.rpc("create_owner", {
        p_name: (ownerSubmitted.owner_name as string | null) ?? null,
        p_phone: (ownerSubmitted.owner_phone as string | null) ?? null,
        p_line: (ownerSubmitted.owner_line as string | null) ?? null,
      });
      if (ownerInsertError || newOwnerId == null) {
        return { ok: false, error: ownerInsertError?.message ?? "สร้างเจ้าของใหม่ไม่สำเร็จ" };
      }
      corePatch.owner_id = newOwnerId;
      ownerAudit = {
        action: "insert",
        entityId: String(newOwnerId),
        before: null,
        after: ownerSubmitted,
      };
    }
  }

  if (Object.keys(corePatch).length === 0 && !ownerAudit) {
    return { ok: true, unchanged: true };
  }

  if (Object.keys(corePatch).length > 0) {
    const { error: updateError } = await supabase
      .from("main_4_listing_database")
      .update(corePatch)
      .eq("listing_id", listingId);
    if (updateError) return { ok: false, error: updateError.message };

    const before: Row = {};
    for (const k of Object.keys(corePatch)) before[k] = current[k] ?? null;
    await writeAudit(supabase, auth.employeeCode, "main_4_listing_database", listingId, "update", before, corePatch);
  }

  if (ownerAudit) {
    await writeAudit(
      supabase,
      auth.employeeCode,
      "main_2_owner",
      ownerAudit.entityId,
      ownerAudit.action,
      ownerAudit.before,
      ownerAudit.after
    );
  }

  revalidatePath("/listings");
  revalidatePath(`/listings/${listingId}`);
  revalidatePath("/company-listings");

  return { ok: true };
}
