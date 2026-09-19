"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import {
  QUEUE_NEXT,
  PORTALS,
  FB_GROUP_SLOTS,
  portalLinkProblem,
  isUrl,
  type BoardKey,
  type PortalKey,
} from "@/lib/supportRules";
import { todayISO } from "@/lib/momentum";

// โต๊ะงาน Support — the writes the desk makes. Same shape as lib/mutations/listings.ts:
// identity from the session, the current row re-read from the database (never the client's
// idea of it), a guarded write, an audit row, a revalidate.
//
// The status changes run through the table's own trigger, which now stamps WHO changed it in
// main_9_support_log (migration 20260919100136) — that log is Support's record of work.

type Result = { ok: true } | { ok: false; error: string };

async function requireSupport(): Promise<{ employeeCode: string } | { error: string }> {
  const auth = await getAuthContext();
  if (!auth?.employeeCode) return { error: "ไม่พบสิทธิ์ผู้ใช้ กรุณาเข้าสู่ระบบใหม่" };
  const perms = new Set(auth.permissions);
  if (!(perms.has("support.workspace") || perms.has("roles.manage"))) {
    return { error: "ไม่มีสิทธิ์ใช้โต๊ะงาน Support" };
  }
  return { employeeCode: auth.employeeCode };
}

function revalidateDesk(listingId: string) {
  revalidatePath("/support", "layout");
  revalidatePath("/listings");
  revalidatePath(`/listings/${listingId}`);
  revalidatePath("/company-listings");
}

/**
 * ลงประกาศใหม่: save the portal links and move Ready to Post → Posted in one write.
 *
 * Livinginsider and PropertyHub are the minimum (Ben, 2026-09-19); DDproperty is optional.
 * A link already on the row counts — a listing half-posted yesterday only needs the rest.
 */
export async function publishListing(
  listingId: string,
  links: Partial<Record<PortalKey, string>>
): Promise<Result> {
  const auth = await requireSupport();
  if ("error" in auth) return { ok: false, error: auth.error };

  for (const p of PORTALS) {
    const problem = portalLinkProblem(p.key, links[p.key] ?? "");
    if (problem) return { ok: false, error: problem };
  }

  const supabase = await createClient();
  const { data: current, error: readErr } = await supabase
    .from("main_4_listing_database")
    .select("listing_status, ddproperty_link, livinginsider_link, propertyhub_link")
    .eq("listing_id", listingId)
    .maybeSingle();
  if (readErr || !current) return { ok: false, error: readErr?.message ?? "ไม่พบทรัพย์นี้" };
  if (current.listing_status !== "Ready to Post") {
    return { ok: false, error: `ทรัพย์นี้สถานะ "${current.listing_status ?? "ว่าง"}" แล้ว — ไม่ได้รอลงประกาศ` };
  }

  const patch: Record<string, string> = {};
  const merged: Record<PortalKey, string | null> = {
    ddproperty_link: current.ddproperty_link,
    livinginsider_link: current.livinginsider_link,
    propertyhub_link: current.propertyhub_link,
  };
  for (const p of PORTALS) {
    const v = (links[p.key] ?? "").trim();
    if (v && v !== merged[p.key]) {
      patch[p.key] = v;
      merged[p.key] = v;
    }
  }
  const missing = PORTALS.filter((p) => p.required && !merged[p.key]).map((p) => p.label);
  if (missing.length) return { ok: false, error: `ยังขาดลิงก์ ${missing.join(" และ ")}` };

  patch.listing_status = QUEUE_NEXT["Ready to Post"];

  // `.eq("listing_status", "Ready to Post")` makes the write conditional: if someone moved
  // the listing on in the meantime, nothing is written and we say so instead of overwriting.
  const { data: updated, error } = await supabase
    .from("main_4_listing_database")
    .update(patch)
    .eq("listing_id", listingId)
    .eq("listing_status", "Ready to Post")
    .select("listing_id");
  if (error) return { ok: false, error: error.message };
  if (!updated?.length) return { ok: false, error: "สถานะทรัพย์เพิ่งถูกเปลี่ยนโดยคนอื่น — รีเฟรชแล้วลองใหม่" };

  const before: Record<string, string | null> = { listing_status: current.listing_status };
  for (const p of PORTALS) if (p.key in patch) before[p.key] = current[p.key];
  await supabase.from("audit_log").insert({
    entity: "main_4_listing_database",
    entity_id: listingId,
    action: "support_publish",
    changed_by: auth.employeeCode,
    before,
    after: patch,
  });

  revalidateDesk(listingId);
  return { ok: true };
}

/**
 * อัปเดตประกาศเสร็จ: the portals now match what the sale asked for, so the status moves on
 * — Update → Posted · Sold → Sold Completed · Cancel → Cancel Completed.
 * `expected` is the status the desk showed; if it has changed since, nothing is written.
 */
export async function finishPortalUpdate(listingId: string, expected: string): Promise<Result> {
  const auth = await requireSupport();
  if ("error" in auth) return { ok: false, error: auth.error };

  const next = QUEUE_NEXT[expected];
  if (!next || expected === "Ready to Post") return { ok: false, error: "สถานะนี้ไม่ได้อยู่ในคิวอัปเดตประกาศ" };

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("main_4_listing_database")
    .update({ listing_status: next })
    .eq("listing_id", listingId)
    .eq("listing_status", expected)
    .select("listing_id");
  if (error) return { ok: false, error: error.message };
  if (!updated?.length) return { ok: false, error: "สถานะทรัพย์เพิ่งถูกเปลี่ยนโดยคนอื่น — รีเฟรชแล้วลองใหม่" };

  await supabase.from("audit_log").insert({
    entity: "main_4_listing_database",
    entity_id: listingId,
    action: "support_finish_update",
    changed_by: auth.employeeCode,
    before: { listing_status: expected },
    after: { listing_status: next },
  });

  revalidateDesk(listingId);
  return { ok: true };
}

/* ── Facebook Post board ──────────────────────────────────────────────────────── */

/**
 * One Facebook-group post: fill the next empty slot of five, or — once all five hold a link —
 * overwrite the oldest (Ben, 2026-09-19). The checklist's "Facebook Group" step is stamped
 * with the same date and link so the listing's checklist card agrees with the board, and the
 * post goes to audit_log, which is where an overwritten link can still be found.
 */
export async function recordFbGroupPost(listingId: string, url: string): Promise<Result> {
  const auth = await requireSupport();
  if ("error" in auth) return { ok: false, error: auth.error };
  const link = url.trim();
  if (!isUrl(link)) return { ok: false, error: "วางลิงก์โพสต์ (ขึ้นต้นด้วย https://)" };

  const supabase = await createClient();
  const { data: existing, error: readErr } = await supabase
    .from("listing_fb_group_post")
    .select("slot, url, posted_on")
    .eq("listing_id", listingId);
  if (readErr) return { ok: false, error: readErr.message };
  const taken = (existing ?? []) as { slot: number; url: string; posted_on: string }[];
  if (taken.some((p) => p.url === link)) return { ok: false, error: "ลิงก์นี้บันทึกไว้แล้ว" };

  let slot: number;
  let replaced: { slot: number; url: string; posted_on: string } | null = null;
  const free = Array.from({ length: FB_GROUP_SLOTS }, (_, i) => i + 1).find((s) => !taken.some((p) => p.slot === s));
  if (free != null) {
    slot = free;
  } else {
    replaced = [...taken].sort((a, b) => a.posted_on.localeCompare(b.posted_on) || a.slot - b.slot)[0];
    slot = replaced.slot;
  }

  const today = todayISO();
  const { error } = await supabase.from("listing_fb_group_post").upsert(
    {
      listing_id: listingId,
      slot,
      url: link,
      posted_on: today,
      posted_by: auth.employeeCode,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "listing_id,slot" }
  );
  if (error) return { ok: false, error: error.message };

  const groupItem = await boardItemId(supabase, "fb_group");
  if (groupItem != null) {
    await supabase.from("listing_checklist_item").upsert(
      {
        listing_id: listingId,
        template_item_id: groupItem,
        due_date: today,
        url: link,
        completed_by: auth.employeeCode,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "listing_id,template_item_id" }
    );
  }

  await supabase.from("audit_log").insert({
    entity: "listing_fb_group_post",
    entity_id: `${listingId}:${slot}`,
    action: "fb_group_post",
    changed_by: auth.employeeCode,
    before: replaced,
    after: { slot, url: link, posted_on: today },
  });

  revalidateDesk(listingId);
  return { ok: true };
}

async function boardItemId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  key: BoardKey
): Promise<number | null> {
  const { data } = await supabase.from("checklist_template_item").select("id").eq("board_key", key).maybeSingle();
  return (data as { id: number } | null)?.id ?? null;
}

/**
 * A board cell that is a checklist step: Template Link (a URL) or Marketplace / Profile /
 * Page (ticks).
 */
export async function setBoardStep(
  listingId: string,
  key: Exclude<BoardKey, "fb_group">,
  value: boolean | string
): Promise<Result> {
  const auth = await requireSupport();
  if ("error" in auth) return { ok: false, error: auth.error };

  const supabase = await createClient();
  const itemId = await boardItemId(supabase, key);
  if (itemId == null) return { ok: false, error: "ไม่พบขั้นตอนนี้ในเช็คลิสต์ — มีคนลบออกจากตั้งค่าหรือไม่" };

  const { data: before } = await supabase
    .from("listing_checklist_item")
    .select("completed_at, due_date, url")
    .eq("listing_id", listingId)
    .eq("template_item_id", itemId)
    .maybeSingle();

  const row: Record<string, unknown> = {
    listing_id: listingId,
    template_item_id: itemId,
    updated_at: new Date().toISOString(),
  };
  if (key === "template_link") {
    const link = String(value).trim();
    if (link && !isUrl(link)) return { ok: false, error: "Template Link ต้องเป็นลิงก์ที่ขึ้นต้นด้วย https://" };
    row.url = link || null;
  } else {
    row.completed_at = value ? new Date().toISOString() : null;
    row.completed_by = value ? auth.employeeCode : null;
  }

  const { error } = await supabase
    .from("listing_checklist_item")
    .upsert(row, { onConflict: "listing_id,template_item_id" });
  if (error) return { ok: false, error: error.message };

  await supabase.from("audit_log").insert({
    entity: "listing_checklist_item",
    entity_id: `${listingId}:${itemId}`,
    action: `board_${key}`,
    changed_by: auth.employeeCode,
    before: before ?? null,
    after: row,
  });

  revalidateDesk(listingId);
  return { ok: true };
}

/** Exclusive: the date the post was pinned, or its agreement window. */
export async function setExclusiveDates(
  listingId: string,
  patch: { pinnedOn?: string | null; agreementStart?: string | null; agreementEnd?: string | null }
): Promise<Result> {
  const auth = await requireSupport();
  if ("error" in auth) return { ok: false, error: auth.error };

  const update: Record<string, string | null> = {};
  if (patch.pinnedOn !== undefined) update.fb_pinned_on = patch.pinnedOn || null;
  if (patch.agreementStart !== undefined) update.agreement_start = patch.agreementStart || null;
  if (patch.agreementEnd !== undefined) update.agreement_end = patch.agreementEnd || null;
  if (!Object.keys(update).length) return { ok: true };

  const supabase = await createClient();
  const { data: current, error: readErr } = await supabase
    .from("main_4_listing_database")
    .select("fb_pinned_on, agreement_start, agreement_end")
    .eq("listing_id", listingId)
    .maybeSingle();
  if (readErr || !current) return { ok: false, error: readErr?.message ?? "ไม่พบทรัพย์นี้" };

  const start = "agreement_start" in update ? update.agreement_start : current.agreement_start;
  const end = "agreement_end" in update ? update.agreement_end : current.agreement_end;
  if (start && end && start > end) return { ok: false, error: "วันสิ้นสุดสัญญาต้องไม่ก่อนวันเริ่มสัญญา" };

  const { error } = await supabase.from("main_4_listing_database").update(update).eq("listing_id", listingId);
  if (error) return { ok: false, error: error.message };

  const before: Record<string, string | null> = {};
  for (const k of Object.keys(update)) before[k] = current[k as keyof typeof current] ?? null;
  await supabase.from("audit_log").insert({
    entity: "main_4_listing_database",
    entity_id: listingId,
    action: "support_exclusive_dates",
    changed_by: auth.employeeCode,
    before,
    after: update,
  });

  revalidateDesk(listingId);
  return { ok: true };
}

/**
 * Fix or remove a group-post link already on the board (Ben, 2026-09-19: a mistyped link
 * could not be corrected). Editing keeps the slot's post date — the post happened, only its
 * link was wrong. Afterwards the checklist's "Facebook Group" step is re-pointed at whatever
 * is now the latest post (or cleared), so the listing card never shows a link the board no
 * longer has.
 */
export async function editFbGroupPost(listingId: string, slot: number, url: string | null): Promise<Result> {
  const auth = await requireSupport();
  if ("error" in auth) return { ok: false, error: auth.error };
  const link = url?.trim() ?? "";
  if (url !== null && !isUrl(link)) return { ok: false, error: "วางลิงก์โพสต์ (ขึ้นต้นด้วย https://)" };

  const supabase = await createClient();
  const { data: rows, error: readErr } = await supabase
    .from("listing_fb_group_post")
    .select("slot, url, posted_on")
    .eq("listing_id", listingId);
  if (readErr) return { ok: false, error: readErr.message };
  const posts = (rows ?? []) as { slot: number; url: string; posted_on: string }[];
  const current = posts.find((p) => p.slot === slot);
  if (!current) return { ok: false, error: "ไม่พบโพสต์ช่องนี้ — รีเฟรชแล้วลองใหม่" };
  if (url !== null && posts.some((p) => p.slot !== slot && p.url === link)) {
    return { ok: false, error: "ลิงก์นี้อยู่ในช่องอื่นแล้ว" };
  }

  const write =
    url === null
      ? supabase.from("listing_fb_group_post").delete().eq("listing_id", listingId).eq("slot", slot)
      : supabase
          .from("listing_fb_group_post")
          .update({ url: link, posted_by: auth.employeeCode, updated_at: new Date().toISOString() })
          .eq("listing_id", listingId)
          .eq("slot", slot);
  const { error } = await write;
  if (error) return { ok: false, error: error.message };

  // Re-point the checklist step at the latest remaining post.
  const remaining = posts
    .filter((p) => p.slot !== slot)
    .concat(url === null ? [] : [{ ...current, url: link }])
    .sort((a, b) => b.posted_on.localeCompare(a.posted_on) || b.slot - a.slot);
  const latest = remaining[0] ?? null;
  const groupItem = await boardItemId(supabase, "fb_group");
  if (groupItem != null) {
    await supabase.from("listing_checklist_item").upsert(
      {
        listing_id: listingId,
        template_item_id: groupItem,
        due_date: latest?.posted_on ?? null,
        url: latest?.url ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "listing_id,template_item_id" }
    );
  }

  await supabase.from("audit_log").insert({
    entity: "listing_fb_group_post",
    entity_id: `${listingId}:${slot}`,
    action: url === null ? "fb_group_post_delete" : "fb_group_post_edit",
    changed_by: auth.employeeCode,
    before: current,
    after: url === null ? null : { slot, url: link, posted_on: current.posted_on },
  });

  revalidateDesk(listingId);
  return { ok: true };
}
