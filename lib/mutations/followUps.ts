"use server";

/* The three things you can do to an overdue row without leaving the dashboard.
 *
 * ── TWO VERBS, AND THEY ARE DIFFERENT ───────────────────────────────────────────
 *   logFollowUp    "I'll ring her while I'm here." Writes the activity now; the row
 *                  leaves the list on the next render because the record moved.
 *   promoteToPlan  "Not now, but today." Writes a task linked to the record. Ticking
 *                  THAT is what logs the activity, through the existing plan machinery.
 *
 * Collapsing them into one button was the tempting build and is wrong: logging is a fact
 * about the past and planning is an intention about the day, and a single control would
 * have had to guess which one somebody meant.
 *
 * ── NOTHING HERE INVENTS A WRITE ────────────────────────────────────────────────
 * Both verbs go through the mutations that already exist — logLeadActivity /
 * logListingActivity, and createTask. That matters more than it looks: those functions
 * carry the permission checks, the audit rows, the date guards, and the update to the
 * record's follow-up clock that is the entire reason the row disappears. A direct insert
 * here would have reproduced four of those and forgotten the fifth.
 */

import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import { logLeadActivity, logListingActivity } from "@/lib/mutations/activity";
import { createTask } from "@/lib/mutations/tasks";
import { FOLLOW_UP_ACTION, type FollowUpDetail, type FollowUpSide } from "@/lib/followUps";

type Result = { ok: true } | { ok: false; error: string };

/** How many past conversations the drawer shows. Enough to remember where you left off,
    not the record's whole history — that is one tap away inside the drawer. */
const RECENT = 5;

/**
 * Log the follow-up as having happened, right now.
 *
 * Blank note on purpose. The button means "I contacted them", and forcing a sentence
 * before the row will clear is how a one-tap action becomes a form nobody uses. The note
 * belongs on the record if there is one worth writing.
 */
export async function logFollowUp(side: FollowUpSide, id: string): Promise<Result> {
  const input = { action: FOLLOW_UP_ACTION[side], note: "", date: "", count: 1 };
  const res = side === "lead" ? await logLeadActivity(id, input) : await logListingActivity(id, input);
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

/**
 * Put it on today's plan as a real, linked task.
 *
 * `activityType` is what makes the loop close: `setTaskDone` writes an `activities` row
 * for a task that carries one, which updates the record's follow-up clock, which is what
 * finally takes the row off this list. Promoting alone changes nothing about the record —
 * and it must not, or the plan would be a list of things already counted as done.
 */
export async function promoteToPlan(
  side: FollowUpSide,
  id: string,
  name: string
): Promise<Result> {
  const auth = await getAuthContext();
  if (!auth?.employeeCode) return { ok: false, error: "ไม่พบสิทธิ์ผู้ใช้ กรุณาเข้าสู่ระบบใหม่" };

  const supabase = await createClient();
  const today = new Date();
  const date = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);

  /* Refuse a second task for the same record on the same day. The card's + hides itself
     once `onPlan` is true, but that flag is a render old — two taps before the refresh
     lands, or the same lead open in two windows, would otherwise write two tasks that
     both log an activity when ticked. */
  const column = side === "lead" ? "related_lead_id" : "related_listing_id";
  const { data: existing } = await supabase
    .from("tasks")
    .select("id")
    .eq("employee_code", auth.employeeCode)
    .eq("task_date", date)
    .not("done", "is", true)
    .eq(column, id)
    .limit(1);
  if (existing && existing.length > 0) return { ok: true };

  const res = await createTask({
    title: `ติดตาม ${name}`.trim(),
    date,
    type: "work",
    activityType: FOLLOW_UP_ACTION[side],
    relatedLeadId: side === "lead" ? id : null,
    relatedListingId: side === "listing" ? id : null,
  });
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

/**
 * What was said last, so the call can be made from here.
 *
 * Ben, 2026-09-10: this is the half Klaichan added after Cream's "ไม่เห็นว่าต้องคุยยังไงต่อ"
 * — she could not see what to say next. They first answered it by linking to the record
 * and then found that takes you off a call list that re-sorts itself, so coming back means
 * finding your place again. The history comes to the list instead.
 */
export async function fetchFollowUpDetail(
  side: FollowUpSide,
  id: string
): Promise<FollowUpDetail> {
  const supabase = await createClient();

  const recentOf = async (column: "related_lead_id" | "related_listing_id") => {
    const { data } = await supabase
      .from("activities")
      .select("id,action,activity_date,remark")
      .eq(column, id)
      .order("activity_date", { ascending: false })
      .order("id", { ascending: false })
      .limit(RECENT);
    return ((data ?? []) as {
      id: number;
      action: string | null;
      activity_date: string;
      remark: string | null;
    }[]).map((a) => ({ id: a.id, kind: a.action, date: a.activity_date, note: a.remark }));
  };

  if (side === "lead") {
    const [{ data: lead }, recent] = await Promise.all([
      supabase
        .from("main_6_buyer_crm")
        .select("phone,line_id,pipeline_stage,listing_code")
        .eq("lead_id", id)
        .maybeSingle(),
      recentOf("related_lead_id"),
    ]);
    const l = lead as {
      phone: string | null;
      line_id: string | null;
      pipeline_stage: string | null;
      listing_code: string | null;
    } | null;
    return {
      phone: l?.phone ?? null,
      lineId: l?.line_id ?? null,
      state: l?.pipeline_stage ?? null,
      subtitle: l?.listing_code ?? null,
      recent,
    };
  }

  const [{ data: listing }, recent] = await Promise.all([
    supabase
      .from("v_main_listing")
      .select("owner_phone,owner_line,owner_stage,listing_name")
      .eq("listing_id", id)
      .maybeSingle(),
    recentOf("related_listing_id"),
  ]);
  const l = listing as {
    owner_phone: string | null;
    owner_line: string | null;
    owner_stage: string | null;
    listing_name: string | null;
  } | null;
  return {
    phone: l?.owner_phone ?? null,
    lineId: l?.owner_line ?? null,
    state: l?.owner_stage ?? null,
    subtitle: l?.listing_name ?? null,
    recent,
  };
}
