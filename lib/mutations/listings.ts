"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import { LISTING_COLUMN_FIELDS, type ListingField } from "@/lib/listingFields";

// First write path in the app (Phase 5 #1) — see the plan this followed for the full design
// rationale. Every Phase 5 mutation after this one should copy this shape: resolve identity
// server-side, re-fetch the current row (never trust the client's idea of "before"), filter
// the patch by both field existence AND permission, diff before writing, audit what actually
// changed, revalidate.

type FieldType = "text" | "integer" | "numeric" | "boolean" | "date";
type FieldGroup = "core" | "marketing";

// `listing_name` and `project_name_eng` are deliberately absent: NEITHER is a column on
// main_4_listing_database. Both live on main_3_property_detail (shared by every listing in
// the project) and reach the app only through v_main_listing —
// `listing_name = main_3.project_name_thai`. Listing them here would send an UPDATE naming a
// column that does not exist, which Postgres rejects outright.
/**
 * Column → type + permission group, DERIVED from lib/listingFields.ts.
 *
 * It used to be hand-written here as well as in each form, which is how เพิ่มทรัพย์ ended up
 * offering 14 fields against แก้ไข's 44. One list now feeds both forms and both mutations.
 */
const FIELD_TYPE: Record<ListingField["kind"], FieldType> = {
  text: "text",
  textarea: "text",
  select: "text",
  integer: "integer",
  numeric: "numeric",
  boolean: "boolean",
  date: "date",
};

const LISTING_FIELDS: Record<string, { type: FieldType; group: FieldGroup }> = Object.fromEntries(
  LISTING_COLUMN_FIELDS.map((f) => [f.key, { type: FIELD_TYPE[f.kind], group: f.group }])
);

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

// ── Intake (Phase 5 #5) ──────────────────────────────────────────────────────

export interface NewProjectInput {
  nameThai: string;
  nameEng?: string;
  propertyType?: string | null;
  zone?: string | null;
}

/**
 * Create a project so a listing can point at one.
 *
 * Reachable by plain agents on purpose: main_3_property_detail's INSERT policy already reads
 * `projects.edit OR listings.create OR roles.manage`, and an agent filing a listing for a
 * village that isn't in the system yet has no other way forward.
 *
 * No RPC needed (unlike create_owner): the SELECT policy here is a flat `listings.view`
 * check rather than a row-scoped one, so INSERT ... RETURNING passes.
 */
export async function createProject(
  input: NewProjectInput
): Promise<{ ok: true; projectId: string } | { ok: false; error: string }> {
  const auth = await getAuthContext();
  if (!auth?.employeeCode) return { ok: false, error: "ไม่พบสิทธิ์ผู้ใช้ กรุณาเข้าสู่ระบบใหม่" };
  const perms = new Set(auth.permissions);
  if (!(perms.has("listings.create") || perms.has("projects.edit") || perms.has("roles.manage"))) {
    return { ok: false, error: "ไม่มีสิทธิ์สร้างโครงการ" };
  }

  const nameThai = input.nameThai.trim();
  if (!nameThai) return { ok: false, error: "ต้องระบุชื่อโครงการ" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("main_3_property_detail")
    .insert({
      project_name_thai: nameThai,
      project_name_eng: input.nameEng?.trim() || null,
      property_type: input.propertyType || null,
      zone: input.zone || null,
    })
    .select("project_id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "สร้างโครงการไม่สำเร็จ" };

  await writeAudit(supabase, auth.employeeCode, "main_3_property_detail", data.project_id, "insert", null, {
    project_name_thai: nameThai,
  });

  return { ok: true, projectId: data.project_id };
}

/**
 * Everything the add form can send: the same column set the edit sheet writes, keyed by
 * column name, plus the project it belongs to.
 *
 * Ben, 2026-08-23: the two screens must offer the same fields. They now share
 * lib/listingFields.ts, so this takes a map rather than a hand-listed shape — adding a
 * column there needs no change here.
 */
export interface NewListingInput {
  /** main_3_property_detail.project_id — chosen or created in the form. */
  project_id: string;
  /** Column → value, as strings/booleans straight off the form. */
  values: Record<string, string | boolean | null>;
}

export async function createListing(
  input: NewListingInput
): Promise<{ ok: true; listingId: string } | { ok: false; error: string }> {
  const auth = await getAuthContext();
  if (!auth?.employeeCode) return { ok: false, error: "ไม่พบสิทธิ์ผู้ใช้ กรุณาเข้าสู่ระบบใหม่" };
  const perms = new Set(auth.permissions);
  if (!(perms.has("listings.create") || perms.has("roles.manage"))) {
    return { ok: false, error: "ไม่มีสิทธิ์เพิ่มทรัพย์" };
  }
  const str = (k: string) => {
    const v = input.values[k];
    return typeof v === "string" ? v.trim() : "";
  };

  // The listing_id trigger builds the code from the property type's letter + the zone, and
  // RAISES if either is missing. Catch it here so the user gets a sentence instead of a
  // Postgres exception.
  if (!str("property_type")) return { ok: false, error: "ต้องเลือกประเภททรัพย์ (ใช้สร้างรหัสทรัพย์)" };
  if (!str("zone")) return { ok: false, error: "ต้องเลือกโซน (ใช้สร้างรหัสทรัพย์)" };

  const supabase = await createClient();

  // Owner first — the listing carries the FK, and create_owner exists because a fresh owner
  // row isn't visible to its own creator under main_2_owner's SELECT policy (Phase 5 #1).
  let ownerId: number | null = null;
  const ownerName = str("owner_name");
  const ownerPhone = str("owner_phone");
  const ownerLine = str("owner_line");
  if (ownerName || ownerPhone || ownerLine) {
    const { data: newOwnerId, error: ownerError } = await supabase.rpc("create_owner", {
      p_name: ownerName || null,
      p_phone: ownerPhone || null,
      p_line: ownerLine || null,
    });
    if (ownerError || newOwnerId == null) {
      return { ok: false, error: ownerError?.message ?? "สร้างเจ้าของไม่สำเร็จ" };
    }
    ownerId = newOwnerId as number;
  }

  const row: Record<string, unknown> = {
    project_id: input.project_id || null,
    // ⚠️ NOT taken from the form (Ben, 2026-08-17): whoever creates the listing is the agent
    // on it. The old dropdown let anyone file a listing under a colleague's name, and
    // defaulted to "— ไม่ระบุ —", which left it owned by nobody until someone noticed.
    sale_id: auth.employeeCode,
    owner_id: ownerId,
  };

  // Same field map, same permission split and same coercion as updateListing — a marketing
  // field sent by someone without `listings.marketing` is dropped rather than written.
  for (const f of LISTING_COLUMN_FIELDS) {
    if (!(f.key in input.values)) continue;
    if (f.group === "marketing" && !(perms.has("listings.marketing") || perms.has("roles.manage"))) {
      continue;
    }
    if (f.group === "core" && !(perms.has("listings.create") || perms.has("listings.edit") || perms.has("roles.manage"))) {
      continue;
    }
    row[f.key] = coerce(FIELD_TYPE[f.kind], input.values[f.key] ?? null);
  }

  const { data, error } = await supabase
    .from("main_4_listing_database")
    .insert(row)
    .select("listing_id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "เพิ่มทรัพย์ไม่สำเร็จ" };

  await writeAudit(supabase, auth.employeeCode, "main_4_listing_database", data.listing_id, "insert", null, row);
  if (ownerId != null) {
    await writeAudit(supabase, auth.employeeCode, "main_2_owner", String(ownerId), "insert", null, {
      owner_name: ownerName || null,
      owner_phone: ownerPhone || null,
    });
  }

  revalidatePath("/listings");
  revalidatePath("/company-listings");

  return { ok: true, listingId: data.listing_id };
}
