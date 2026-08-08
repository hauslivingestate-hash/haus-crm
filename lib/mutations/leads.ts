"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";

// Phase 5 #2 — the lead detail page's three write surfaces (core fields, tag, complaint),
// same shape as lib/mutations/listings.ts: resolve identity server-side, re-fetch the live
// row before diffing (never trust the client), audit what actually changed, revalidate.

type Result = { ok: true } | { ok: false; error: string };
type Row = Record<string, unknown>;

async function requireAuth() {
  const auth = await getAuthContext();
  if (!auth?.employeeCode) return null;
  return { ...auth, employeeCode: auth.employeeCode };
}

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
  leadId: string,
  action: string,
  before: Row,
  after: Row
) {
  await supabase.from("audit_log").insert({
    entity: "main_6_buyer_crm",
    entity_id: leadId,
    action,
    changed_by: changedBy,
    before,
    after,
  });
}

function revalidateLead(leadId: string) {
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
}

// The core edit sheet's fields. RLS's own UPDATE gate is `leads.edit OR leads.assign OR
// roles.manage` (plus row-scoping to own leads unless leads.view_all) — no column-level
// split needed here the way listings needed core/marketing, since every field below is
// something any lead-editor may touch.
const LEAD_FIELDS: Record<string, "text" | "numeric"> = {
  lead_name: "text",
  phone: "text",
  line_id: "text",
  lead_type: "text",
  pipeline_stage: "text",
  lead_status: "text",
  potential: "text",
  budget: "numeric",
};

function coerce(type: "text" | "numeric", value: string | null): unknown {
  if (value === "" || value == null) return null;
  if (type === "numeric") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return value;
}

export async function updateLead(
  leadId: string,
  rawPatch: Record<string, string | null>
): Promise<Result> {
  const auth = await requireAuth();
  if (!auth) return { ok: false, error: "ไม่พบสิทธิ์ผู้ใช้ กรุณาเข้าสู่ระบบใหม่" };
  const perms = new Set(auth.permissions);
  const canEdit = perms.has("leads.edit") || perms.has("leads.assign") || perms.has("roles.manage");
  if (!canEdit) return { ok: false, error: "ไม่มีสิทธิ์แก้ไข Lead" };

  const supabase = await createClient();
  const { data: current, error: fetchError } = await supabase
    .from("main_6_buyer_crm")
    .select("*")
    .eq("lead_id", leadId)
    .maybeSingle();
  if (fetchError || !current) return { ok: false, error: fetchError?.message ?? "ไม่พบ Lead นี้" };

  const submitted: Row = {};
  for (const [key, value] of Object.entries(rawPatch)) {
    const type = LEAD_FIELDS[key];
    if (!type) continue;
    submitted[key] = coerce(type, value);
  }
  const patch = diff(current, submitted);
  if (Object.keys(patch).length === 0) return { ok: true };

  const { error: updateError } = await supabase
    .from("main_6_buyer_crm")
    .update(patch)
    .eq("lead_id", leadId);
  if (updateError) return { ok: false, error: updateError.message };

  const before: Row = {};
  for (const k of Object.keys(patch)) before[k] = current[k] ?? null;
  await writeAudit(supabase, auth.employeeCode, leadId, "update", before, patch);

  revalidateLead(leadId);
  return { ok: true };
}

export async function setLeadTag(leadId: string, tagId: string | null): Promise<Result> {
  const auth = await requireAuth();
  if (!auth) return { ok: false, error: "ไม่พบสิทธิ์ผู้ใช้ กรุณาเข้าสู่ระบบใหม่" };
  const perms = new Set(auth.permissions);
  const canEdit = perms.has("leads.edit") || perms.has("leads.assign") || perms.has("roles.manage");
  if (!canEdit) return { ok: false, error: "ไม่มีสิทธิ์แก้ไข Lead" };

  const supabase = await createClient();
  const { data: current, error: fetchError } = await supabase
    .from("main_6_buyer_crm")
    .select("tag_id")
    .eq("lead_id", leadId)
    .maybeSingle();
  if (fetchError || !current) return { ok: false, error: fetchError?.message ?? "ไม่พบ Lead นี้" };

  const nextTag = tagId || null;
  const beforeTag = current.tag_id ?? null;
  if (beforeTag === nextTag) return { ok: true };

  const { error: updateError } = await supabase
    .from("main_6_buyer_crm")
    .update({ tag_id: nextTag })
    .eq("lead_id", leadId);
  if (updateError) return { ok: false, error: updateError.message };

  await writeAudit(supabase, auth.employeeCode, leadId, "set_tag", { tag_id: beforeTag }, { tag_id: nextTag });

  revalidateLead(leadId);
  return { ok: true };
}

export async function setLeadComplaint(
  leadId: string,
  patch: { customerComplain: string | null; complainStatus: string | null; complainRemark: string | null }
): Promise<Result> {
  const auth = await requireAuth();
  if (!auth) return { ok: false, error: "ไม่พบสิทธิ์ผู้ใช้ กรุณาเข้าสู่ระบบใหม่" };
  const perms = new Set(auth.permissions);
  if (!(perms.has("leads.assign") || perms.has("roles.manage"))) {
    return { ok: false, error: "ไม่มีสิทธิ์จัดการข้อร้องเรียน" };
  }

  const supabase = await createClient();
  const { data: current, error: fetchError } = await supabase
    .from("main_6_buyer_crm")
    .select("customer_complain,complain_status,complain_remark")
    .eq("lead_id", leadId)
    .maybeSingle();
  if (fetchError || !current) return { ok: false, error: fetchError?.message ?? "ไม่พบ Lead นี้" };

  const next: Row = {
    customer_complain: patch.customerComplain || null,
    complain_status: patch.complainStatus || null,
    complain_remark: patch.complainRemark || null,
  };
  const before: Row = {
    customer_complain: current.customer_complain ?? null,
    complain_status: current.complain_status ?? null,
    complain_remark: current.complain_remark ?? null,
  };
  if (JSON.stringify(before) === JSON.stringify(next)) return { ok: true };

  const { error: updateError } = await supabase
    .from("main_6_buyer_crm")
    .update(next)
    .eq("lead_id", leadId);
  if (updateError) return { ok: false, error: updateError.message };

  await writeAudit(supabase, auth.employeeCode, leadId, "set_complaint", before, next);

  revalidateLead(leadId);
  return { ok: true };
}
