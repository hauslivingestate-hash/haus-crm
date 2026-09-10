"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";

/* Logging work against a lead — the write that makes lib/leadTimeline.ts real.
 *
 * ── WHY THIS GOES IN `activities` AND NOT A NEW TABLE ───────────────────────────
 * `activities` already holds 2,646 rows and already has `related_lead_id`, which had
 * never once been written to: every row is a daily KPI tally (Show × 3 on the 25th) with
 * no lead attached. That column was always the plan; nothing had filled it.
 *
 * Reusing it means a follow-up logged on a lead ALSO counts toward the agent's KPI and
 * probation ladder, which is the behaviour the team already expects from ticking the same
 * action off in แผนวันนี้ — one action, counted once, wherever it was entered. A separate
 * "lead notes" table would have split that in two and left the dashboard undercounting
 * exactly the work people took the trouble to record against a customer.
 *
 * ── task_id STAYS NULL ──────────────────────────────────────────────────────────
 * `activities.task_id` is UNIQUE and owned by lib/mutations/tasks.ts, which deletes and
 * re-inserts its row whenever a task is re-ticked. A note logged here is not a task, so it
 * leaves that column alone and is never touched by that sync.
 */

type Result = { ok: true; movedTo?: string } | { ok: false; error: string };

export interface LeadActivityInput {
  /** From the `activities.action` reference list — Call, Follow, Show, Appoint, … */
  action: string;
  /** The note. Optional: "Show × 1" with no words is still a fact worth recording. */
  note: string;
  /** ISO yyyy-mm-dd. Blank means today. Back-dating is allowed — people write up a week
      of viewings on a Friday — but the future is not, since a plan is not an activity. */
  date: string;
  /** How many. The KPI tallies count, so "โทร 5 สาย" is one row with count 5. */
  count?: number;
  /** Move the record's stage as part of this log. A stage NAME, or omitted for no change.
   *
   *  This used to be a boolean that meant "move to whatever stage this action implies",
   *  which only worked for actions named after a stage: logging Owner Visit offered a move
   *  and logging ถ่ายรูป offered nothing, so the control appeared and vanished with no rule
   *  the user could see (Ben, 2026-09-10: "shouldn't it apply on all the stages?").
   *
   *  Now the caller names the stage. Every stage is reachable from every action, nothing is
   *  guessed, and — because the choice is deliberate — a backwards move is allowed here just
   *  as it is when tapping the pills. The old version refused those, which was the right
   *  guard for a move the app had decided by itself and the wrong one for a move a person
   *  chose. */
  moveToStage?: string;
}

/** A pipeline's stage names in their stored order. Both pipelines are editable in ตั้งค่า,
    so neither the members nor the order may be assumed from code. */
async function orderedStages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: "pipeline_stage" | "owner_stage"
): Promise<string[]> {
  const { data } = await supabase.from(table).select("name,sort_order").order("sort_order");
  return ((data ?? []) as { name: string }[]).map((r) => r.name);
}

/** Today in the local (Bangkok) day, not UTC — a 9pm log must not land on tomorrow. */
function todayLocalISO(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export async function logLeadActivity(leadId: string, input: LeadActivityInput): Promise<Result> {
  const auth = await getAuthContext();
  if (!auth?.employeeCode) return { ok: false, error: "ไม่พบสิทธิ์ผู้ใช้ กรุณาเข้าสู่ระบบใหม่" };
  const perms = new Set(auth.permissions);
  if (!(perms.has("activity.log") || perms.has("roles.manage"))) {
    return { ok: false, error: "ไม่มีสิทธิ์บันทึกกิจกรรม" };
  }

  const action = input.action.trim();
  if (!action) return { ok: false, error: "กรุณาเลือกประเภทกิจกรรม" };

  const today = todayLocalISO();
  let date = input.date.trim() || today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "วันที่ไม่ถูกต้อง" };
  // Same guard as the deal form: a date before the company existed is a failed parse, not
  // a date. The future is refused outright rather than clamped, so a mistyped year is seen.
  if (date < "2000-01-01") return { ok: false, error: "วันที่ไม่ถูกต้อง" };
  if (date > today) return { ok: false, error: "บันทึกกิจกรรมล่วงหน้าไม่ได้" };
  date = date.slice(0, 10);

  const count = Math.max(1, Math.min(50, Math.trunc(input.count ?? 1) || 1));

  const supabase = await createClient();

  // The lead must exist. Without this an activity can be written against a typo'd id and
  // then never appear anywhere — related_lead_id has no foreign key on this table.
  const { data: lead } = await supabase
    .from("main_6_buyer_crm")
    .select("lead_id,listing_code,pipeline_stage")
    .eq("lead_id", leadId)
    .maybeSingle();
  if (!lead) return { ok: false, error: "ไม่พบ Lead นี้" };

  const { error } = await supabase.from("activities").insert({
    employee_code: auth.employeeCode,
    action,
    activity_date: date,
    count,
    remark: input.note.trim() || null,
    related_lead_id: leadId,
    // Carried through so a viewing logged on a lead also shows on the listing it was for.
    related_listing_id: (lead as { listing_code: string | null }).listing_code ?? null,
  });
  if (error) return { ok: false, error: error.message };

  // Touching the lead is what clears its follow-up clock. Done as a plain update rather
  // than through updateLead(): this is a side effect of logging, not an edit the user
  // made, and it should not land in the audit log as one.
  //
  // `is.null` is in the filter deliberately. A bare .lt() would skip every lead that has
  // never been followed up — NULL is not less than anything in SQL — which is precisely
  // the set of leads this most needs to update. Back-dated entries are filtered out the
  // same way: logging last Tuesday's call today must not pull the clock backwards.
  await supabase
    .from("main_6_buyer_crm")
    .update({ last_follow_date: date })
    .eq("lead_id", leadId)
    .or(`last_follow_date.is.null,last_follow_date.lt.${date}`);

  /* ── The stage move ──────────────────────────────────────────────────────────
     Permission comes from leads.edit, not activity.log: this writes to the lead, and
     someone who may log their own work is not automatically someone who may move it.

     The requested stage is checked against the LIVE list rather than trusted, because the
     pipeline is editable in ตั้งค่า and a stale browser tab can offer a stage that was
     deleted a minute ago. An unrecognised stage is ignored rather than failing the call —
     the note is the part that matters and it is already written. */
  let movedTo: string | undefined;
  const currentStage = (lead as { pipeline_stage: string | null }).pipeline_stage;
  const mayEdit = perms.has("leads.edit") || perms.has("leads.assign") || perms.has("roles.manage");
  const requested = input.moveToStage?.trim() || null;
  const stages = requested && mayEdit ? await orderedStages(supabase, "pipeline_stage") : [];
  const wanted = requested && stages.includes(requested) ? requested : null;
  if (wanted && wanted !== currentStage) {
    const { error: moveError } = await supabase
      .from("main_6_buyer_crm")
      .update({ pipeline_stage: wanted })
      .eq("lead_id", leadId);
    if (!moveError) {
      movedTo = wanted;
      await supabase.from("audit_log").insert({
        entity: "main_6_buyer_crm",
        entity_id: leadId,
        action: "update",
        changed_by: auth.employeeCode,
        before: { pipeline_stage: currentStage },
        after: { pipeline_stage: wanted },
      });
    }
    // A refused move is not a failed log. The activity is already written and is the part
    // that matters; the caller is simply told nothing moved.
  }

  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/today"); // the KPI tallies this feeds
  return { ok: true, movedTo };
}

/* ── The owner side ─────────────────────────────────────────────────────────────
   Same write, against a listing instead of a lead, moving owner_stage instead of
   pipeline_stage. Kept as its own function rather than a `scope` parameter on the one
   above: the two differ in which table they check, which permission they need and which
   pipeline they advance, and a single function taking a discriminator would be three
   branches deep in every one of those. */

export type ListingActivityInput = LeadActivityInput;

export async function logListingActivity(
  listingId: string,
  input: ListingActivityInput
): Promise<Result> {
  const auth = await getAuthContext();
  if (!auth?.employeeCode) return { ok: false, error: "ไม่พบสิทธิ์ผู้ใช้ กรุณาเข้าสู่ระบบใหม่" };
  const perms = new Set(auth.permissions);
  if (!(perms.has("activity.log") || perms.has("roles.manage"))) {
    return { ok: false, error: "ไม่มีสิทธิ์บันทึกกิจกรรม" };
  }

  const action = input.action.trim();
  if (!action) return { ok: false, error: "กรุณาเลือกประเภทกิจกรรม" };

  const today = todayLocalISO();
  const date = input.date.trim() || today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < "2000-01-01") {
    return { ok: false, error: "วันที่ไม่ถูกต้อง" };
  }
  if (date > today) return { ok: false, error: "บันทึกกิจกรรมล่วงหน้าไม่ได้" };

  const count = Math.max(1, Math.min(50, Math.trunc(input.count ?? 1) || 1));

  const supabase = await createClient();
  const { data: listing } = await supabase
    .from("main_4_listing_database")
    .select("listing_id,owner_stage")
    .eq("listing_id", listingId)
    .maybeSingle();
  if (!listing) return { ok: false, error: "ไม่พบทรัพย์นี้" };

  const { error } = await supabase.from("activities").insert({
    employee_code: auth.employeeCode,
    action,
    activity_date: date,
    count,
    remark: input.note.trim() || null,
    related_listing_id: listingId,
  });
  if (error) return { ok: false, error: error.message };

  // Owner-side conversations have their own clock, the same way leads have last_follow_date.
  if (action === "Owner Talk" || action === "Owner Visit") {
    await supabase
      .from("main_4_listing_database")
      .update({ owner_talk_last_date: date })
      .eq("listing_id", listingId)
      .or(`owner_talk_last_date.is.null,owner_talk_last_date.lt.${date}`);
  }

  /* The owner stage move — same contract as the lead side above: an explicit stage name,
     checked against the live list, no guessing from the action. */
  let movedTo: string | undefined;
  const currentStage = (listing as { owner_stage: string | null }).owner_stage;
  const mayEdit = perms.has("listings.edit") || perms.has("roles.manage");
  const requested = input.moveToStage?.trim() || null;
  const stages = requested && mayEdit ? await orderedStages(supabase, "owner_stage") : [];
  const wanted = requested && stages.includes(requested) ? requested : null;
  if (wanted && wanted !== currentStage) {
    const { error: moveError } = await supabase
      .from("main_4_listing_database")
      .update({ owner_stage: wanted })
      .eq("listing_id", listingId);
    if (!moveError) {
      movedTo = wanted;
      await supabase.from("audit_log").insert({
        entity: "main_4_listing_database",
        entity_id: listingId,
        action: "update",
        changed_by: auth.employeeCode,
        before: { owner_stage: currentStage },
        after: { owner_stage: wanted },
      });
    }
  }

  revalidatePath("/listings");
  revalidatePath(`/listings/${listingId}`);
  revalidatePath("/today");
  return { ok: true, movedTo };
}
