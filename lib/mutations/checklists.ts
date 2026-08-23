"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import type { ChecklistItemState, ChecklistTemplate, ExclusiveAgreement } from "@/lib/checklists";

// Value-add checklists — templates (Settings) and per-listing progress (the listing page).
//
// The two halves are gated differently on purpose: only `checklists.manage` may change what
// the steps ARE, but anyone who can edit or market a listing may tick them. Checklist work is
// cross-team — sales talks to the owner, Support collects the documents, Marketing posts —
// so tying the ticks to the listing's own agent would leave most steps untickable by the
// person actually doing them.

type Result = { ok: true } | { ok: false; error: string };

async function requireManage(): Promise<{ employeeCode: string } | { error: string }> {
  const auth = await getAuthContext();
  if (!auth?.employeeCode) return { error: "ไม่พบสิทธิ์ผู้ใช้ กรุณาเข้าสู่ระบบใหม่" };
  const perms = new Set(auth.permissions);
  if (!(perms.has("checklists.manage") || perms.has("roles.manage"))) {
    return { error: "ไม่มีสิทธิ์แก้เทมเพลตเช็คลิสต์" };
  }
  return { employeeCode: auth.employeeCode };
}

async function requireTick(): Promise<{ employeeCode: string } | { error: string }> {
  const auth = await getAuthContext();
  if (!auth?.employeeCode) return { error: "ไม่พบสิทธิ์ผู้ใช้ กรุณาเข้าสู่ระบบใหม่" };
  const perms = new Set(auth.permissions);
  const allowed =
    perms.has("listings.edit") ||
    perms.has("listings.marketing") ||
    perms.has("checklists.manage") ||
    perms.has("roles.manage");
  if (!allowed) return { error: "ไม่มีสิทธิ์แก้เช็คลิสต์ของทรัพย์" };
  return { employeeCode: auth.employeeCode };
}

// ── Templates ───────────────────────────────────────────────────────────────

/**
 * Save every template in one call.
 *
 * Sent as a set, like the probation ladder and the zone editor: the editor reorders
 * templates, adds and removes steps freely, and replaying that as individual row operations
 * would need a diff computed on the client — which is exactly the thing that must not be the
 * source of truth.
 *
 * Deleting a template cascades to its items, and from there to every listing's progress on
 * those items. That is correct — a step that no longer exists has no progress — but it is why
 * the editor asks before deleting.
 */
export async function saveChecklistTemplates(templates: ChecklistTemplate[]): Promise<Result> {
  const auth = await requireManage();
  if ("error" in auth) return { ok: false, error: auth.error };

  for (const t of templates) {
    if (!t.name.trim()) return { ok: false, error: "ทุกเทมเพลตต้องมีชื่อ" };
    if (t.appliesTo.length === 0) {
      return { ok: false, error: `${t.name}: ต้องเลือกอย่างน้อย 1 ระดับ (A-List / Exclusive)` };
    }
    for (const i of t.items) {
      if (!i.label.trim()) return { ok: false, error: `${t.name}: มีขั้นตอนที่ยังไม่มีชื่อ` };
      if (i.type === "cadence" && (!i.repeatDays || i.repeatDays < 1)) {
        return { ok: false, error: `${t.name} · ${i.label}: รอบโพสต์ซ้ำต้องมากกว่า 0 วัน` };
      }
    }
  }

  const supabase = await createClient();

  // Templates the editor no longer holds are gone; their items cascade.
  const keep = templates.map((t) => t.id).filter((id): id is number => typeof id === "number");
  const { data: existing, error: readErr } = await supabase.from("checklist_template").select("id");
  if (readErr) return { ok: false, error: readErr.message };
  const gone = ((existing ?? []) as { id: number }[])
    .map((r) => r.id)
    .filter((id) => !keep.includes(id));
  if (gone.length) {
    const { error } = await supabase.from("checklist_template").delete().in("id", gone);
    if (error) return { ok: false, error: error.message };
  }

  for (const [index, t] of templates.entries()) {
    const row = { name: t.name.trim(), applies_to: t.appliesTo, sort: index + 1 };
    let templateId = t.id;

    if (templateId == null) {
      const { data, error } = await supabase
        .from("checklist_template")
        .insert(row)
        .select("id")
        .single();
      if (error) return { ok: false, error: error.message };
      templateId = (data as { id: number }).id;
    } else {
      const { error } = await supabase.from("checklist_template").update(row).eq("id", templateId);
      if (error) return { ok: false, error: error.message };
    }

    // Replace this template's items wholesale — cheaper to reason about than a diff, and the
    // set is a dozen rows at most.
    const keepItems = t.items.map((i) => i.id).filter((id): id is number => typeof id === "number");
    const { data: haveItems, error: itemsErr } = await supabase
      .from("checklist_template_item")
      .select("id")
      .eq("template_id", templateId);
    if (itemsErr) return { ok: false, error: itemsErr.message };
    const droppedItems = ((haveItems ?? []) as { id: number }[])
      .map((r) => r.id)
      .filter((id) => !keepItems.includes(id));
    if (droppedItems.length) {
      const { error } = await supabase
        .from("checklist_template_item")
        .delete()
        .in("id", droppedItems);
      if (error) return { ok: false, error: error.message };
    }

    for (const [j, i] of t.items.entries()) {
      // repeat_days must be null unless the step is a cadence — the table refuses a leftover.
      const itemRow = {
        template_id: templateId,
        label: i.label.trim(),
        item_type: i.type,
        role: i.role || null,
        repeat_days: i.type === "cadence" ? (i.repeatDays ?? null) : null,
        sort: j + 1,
      };
      if (i.id == null) {
        const { error } = await supabase.from("checklist_template_item").insert(itemRow);
        if (error) return { ok: false, error: error.message };
      } else {
        const { error } = await supabase
          .from("checklist_template_item")
          .update(itemRow)
          .eq("id", i.id);
        if (error) return { ok: false, error: error.message };
      }
    }
  }

  await supabase.from("audit_log").insert({
    entity: "checklist_template",
    entity_id: "all",
    action: "update",
    changed_by: auth.employeeCode,
    before: {},
    after: { templates: templates.length },
  });

  revalidatePath("/settings");
  revalidatePath("/listings");
  return { ok: true };
}

// ── Per-listing progress ────────────────────────────────────────────────────

/**
 * Set one item's state on one listing.
 *
 * Upserted rather than inserted-then-updated: a row exists only once somebody touches the
 * item, so the first write is an insert and every later one an update, and the caller should
 * not have to know which.
 */
export async function setChecklistItemState(
  listingId: string,
  templateItemId: number,
  patch: Partial<ChecklistItemState>
): Promise<Result> {
  const auth = await requireTick();
  if ("error" in auth) return { ok: false, error: auth.error };

  const supabase = await createClient();
  const { data: current, error: readErr } = await supabase
    .from("listing_checklist_item")
    .select("completed_at, completed_by, due_date, url, note")
    .eq("listing_id", listingId)
    .eq("template_item_id", templateItemId)
    .maybeSingle();
  if (readErr) return { ok: false, error: readErr.message };

  const now = current as {
    completed_at: string | null;
    completed_by: string | null;
    due_date: string | null;
    url: string | null;
    note: string | null;
  } | null;

  const next = {
    listing_id: listingId,
    template_item_id: templateItemId,
    completed_at:
      patch.completedAt !== undefined ? patch.completedAt : (now?.completed_at ?? null),
    // Stamp the person from the session, never from the client — this is the record of who
    // did the work.
    completed_by:
      patch.completedAt !== undefined
        ? patch.completedAt
          ? auth.employeeCode
          : null
        : (now?.completed_by ?? null),
    due_date: patch.dueDate !== undefined ? patch.dueDate : (now?.due_date ?? null),
    url: patch.url !== undefined ? patch.url : (now?.url ?? null),
    note: patch.note !== undefined ? patch.note : (now?.note ?? null),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("listing_checklist_item")
    .upsert(next, { onConflict: "listing_id,template_item_id" });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/listings/${listingId}`);
  return { ok: true };
}

/** The signed Exclusive agreement window — lives on the listing itself. */
export async function setExclusiveAgreement(
  listingId: string,
  patch: Partial<ExclusiveAgreement>
): Promise<Result> {
  const auth = await requireTick();
  if ("error" in auth) return { ok: false, error: auth.error };

  const update: Record<string, string | null> = {};
  if (patch.start !== undefined) update.agreement_start = patch.start;
  if (patch.end !== undefined) update.agreement_end = patch.end;
  if (Object.keys(update).length === 0) return { ok: true };

  const supabase = await createClient();
  const { error } = await supabase
    .from("main_4_listing_database")
    .update(update)
    .eq("listing_id", listingId);
  if (error) return { ok: false, error: error.message };

  await supabase.from("audit_log").insert({
    entity: "main_4_listing_database",
    entity_id: listingId,
    action: "set_agreement",
    changed_by: auth.employeeCode,
    before: {},
    after: update,
  });

  revalidatePath(`/listings/${listingId}`);
  return { ok: true };
}
