"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import { readTasks } from "@/lib/plan";
import type { Task, TaskType, RecurFreq } from "@/lib/momentum";

// Phase 5 #6 — the Daily Plan's write path, and the last stub in Phase 5.
//
// Two tables move together here. `tasks` is a private to-do list, but ticking a task that
// carries an `activityType` also writes `activities`, and THAT row is load-bearing: it feeds
// the KPI targets, the new-sales rank ladder and the entity timelines. The +บันทึก FAB was
// deleted in CEO feedback R1, so this tick is the only path by which activity is recorded.
//
// Consequences the code below has to honour:
//   • untick must REMOVE the activity, or a mis-tick permanently inflates someone's numbers
//   • editing a completed task must re-sync it (action, date or entity may all have changed)
//   • `activity.log` is re-checked server-side — Marketing / Listing Support / Admin do not
//     hold it, and a task still ticks for them, it just records nothing

type Result = { ok: true } | { ok: false; error: string };
type Row = Record<string, unknown>;

async function requireAuth() {
  const auth = await getAuthContext();
  if (!auth?.employeeCode) return null;
  return { ...auth, employeeCode: auth.employeeCode };
}

async function writeAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  changedBy: string,
  taskId: number | string,
  action: string,
  before: Row,
  after: Row
) {
  await supabase.from("audit_log").insert({
    entity: "tasks",
    entity_id: String(taskId),
    action,
    changed_by: changedBy,
    before,
    after,
  });
}

/** What the add/edit sheet collects. Ids are the DB's; the date is chosen by the plan. */
export interface TaskInput {
  title: string;
  date: string;
  type: TaskType;
  notes?: string | null;
  targetId?: number | null;
  activityType?: string | null;
  relatedLeadId?: string | null;
  relatedListingId?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  repeatFreq?: RecurFreq | null;
  repeatWeekdays?: number[] | null;
  repeatDayOfMonth?: number | null;
}

function toColumns(input: TaskInput): Row {
  const freq = input.repeatFreq && input.repeatFreq !== "none" ? input.repeatFreq : null;
  return {
    task_date: input.date,
    title: input.title.trim(),
    task_type: input.type,
    notes: input.notes?.trim() || null,
    target_id: input.targetId ?? null,
    activity_type: input.activityType || null,
    related_lead_id: input.relatedLeadId || null,
    related_listing_id: input.relatedListingId || null,
    start_time: input.startTime || null,
    end_time: input.endTime || null,
    repeat_freq: freq,
    repeat_weekdays: freq === "weekly" ? input.repeatWeekdays ?? [] : null,
    repeat_day_of_month: freq === "monthly" ? input.repeatDayOfMonth ?? 1 : null,
  };
}

type TaskState = {
  id: number;
  employee_code: string;
  task_date: string;
  done: boolean | null;
  activity_type: string | null;
  related_lead_id: string | null;
  related_listing_id: string | null;
};

/** Fetch the live row, refusing anything that is not the caller's own task. */
async function ownTask(
  supabase: Awaited<ReturnType<typeof createClient>>,
  employeeCode: string,
  taskId: number
): Promise<TaskState | null> {
  const { data } = await supabase
    .from("tasks")
    .select("id,employee_code,task_date,done,activity_type,related_lead_id,related_listing_id")
    .eq("id", taskId)
    .eq("employee_code", employeeCode)
    .maybeSingle();
  return (data as TaskState) ?? null;
}

/**
 * Make `activities` agree with a task's current state.
 *
 * `activities.task_id` is UNIQUE, so a task owns at most one activity row. Delete-then-insert
 * rather than upsert: the row may need to disappear entirely (task un-ticked, or its action
 * cleared), and its date/entity are copied from the task each time so an edited task cannot
 * leave a stale tally behind. ON DELETE CASCADE covers the task-deleted case for free.
 */
async function syncActivity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  employeeCode: string,
  task: TaskState,
  done: boolean,
  canLog: boolean,
  opts?: { count?: number; remark?: string | null }
): Promise<string | null> {
  await supabase.from("activities").delete().eq("task_id", task.id);
  if (!done || !task.activity_type || !canLog) return null;

  const { error } = await supabase.from("activities").insert({
    employee_code: employeeCode,
    action: task.activity_type,
    // The TASK's date, not today — ticking a back-dated plan item logs it on that day.
    activity_date: task.task_date,
    count: Math.max(1, Math.min(50, opts?.count || 1)),
    remark: opts?.remark?.trim() || null,
    related_lead_id: task.related_lead_id,
    related_listing_id: task.related_listing_id,
    task_id: task.id,
  });
  return error?.message ?? null;
}

function revalidate() {
  revalidatePath("/today");
}

export async function createTask(
  input: TaskInput
): Promise<{ ok: true; task: Task } | { ok: false; error: string }> {
  const auth = await requireAuth();
  if (!auth) return { ok: false, error: "ไม่พบสิทธิ์ผู้ใช้ กรุณาเข้าสู่ระบบใหม่" };
  if (!input.title?.trim()) return { ok: false, error: "กรุณากรอกหัวข้องาน" };

  const supabase = await createClient();

  // Append to the end of that day. Read the max rather than counting rows: a deleted task
  // must not let the next one reuse its position.
  const { data: last } = await supabase
    .from("tasks")
    .select("sort_order")
    .eq("employee_code", auth.employeeCode)
    .eq("task_date", input.date)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const columns = {
    ...toColumns(input),
    employee_code: auth.employeeCode,
    done: false,
    sort_order: ((last?.sort_order as number | undefined) ?? -1) + 1,
  };

  const { data, error } = await supabase.from("tasks").insert(columns).select("id").single();
  if (error || !data) return { ok: false, error: error?.message ?? "เพิ่มงานไม่สำเร็จ" };

  const id = data.id as number;
  await writeAudit(supabase, auth.employeeCode, id, "create", {}, columns);
  revalidate();

  const [task] = await readTasks(auth.employeeCode, input.date, input.date).then((ts) =>
    ts.filter((t) => t.id === id)
  );
  return task
    ? { ok: true, task }
    : { ok: false, error: "เพิ่มงานแล้วแต่อ่านกลับมาไม่ได้ กรุณารีเฟรช" };
}

export async function updateTask(taskId: number, input: TaskInput): Promise<Result> {
  const auth = await requireAuth();
  if (!auth) return { ok: false, error: "ไม่พบสิทธิ์ผู้ใช้ กรุณาเข้าสู่ระบบใหม่" };
  if (!input.title?.trim()) return { ok: false, error: "กรุณากรอกหัวข้องาน" };

  const supabase = await createClient();
  const current = await ownTask(supabase, auth.employeeCode, taskId);
  if (!current) return { ok: false, error: "ไม่พบงานนี้" };

  const columns = toColumns(input);
  const { error } = await supabase
    .from("tasks")
    .update(columns)
    .eq("id", taskId)
    .eq("employee_code", auth.employeeCode);
  if (error) return { ok: false, error: error.message };

  // A completed task's logged activity must follow the edit. Without this, changing the
  // action leaves the old one counted and clearing it strands a row no untick can reach —
  // both silently inflate the KPI targets and the probation ladder.
  if (current.done) {
    const next: TaskState = {
      ...current,
      task_date: columns.task_date as string,
      activity_type: (columns.activity_type as string | null) ?? null,
      related_lead_id: (columns.related_lead_id as string | null) ?? null,
      related_listing_id: (columns.related_listing_id as string | null) ?? null,
    };
    const syncError = await syncActivity(
      supabase,
      auth.employeeCode,
      next,
      true,
      auth.permissions.includes("activity.log")
    );
    if (syncError) return { ok: false, error: syncError };
  }

  await writeAudit(supabase, auth.employeeCode, taskId, "update", current as unknown as Row, columns);
  revalidate();
  return { ok: true };
}

export async function deleteTask(taskId: number): Promise<Result> {
  const auth = await requireAuth();
  if (!auth) return { ok: false, error: "ไม่พบสิทธิ์ผู้ใช้ กรุณาเข้าสู่ระบบใหม่" };

  const supabase = await createClient();
  const current = await ownTask(supabase, auth.employeeCode, taskId);
  if (!current) return { ok: false, error: "ไม่พบงานนี้" };

  // activities.task_id is ON DELETE CASCADE, so the activity a completed task logged goes
  // with it — no orphan row left overstating effort with no UI able to remove it.
  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .eq("employee_code", auth.employeeCode);
  if (error) return { ok: false, error: error.message };

  await writeAudit(supabase, auth.employeeCode, taskId, "delete", current as unknown as Row, {});
  revalidate();
  return { ok: true };
}

/**
 * Tick / untick. `opts` carries the count + remark the completion sheet collects; it is only
 * relevant when a task with an `activityType` is being ticked.
 */
export async function setTaskDone(
  taskId: number,
  done: boolean,
  opts?: { count?: number; remark?: string | null }
): Promise<Result> {
  const auth = await requireAuth();
  if (!auth) return { ok: false, error: "ไม่พบสิทธิ์ผู้ใช้ กรุณาเข้าสู่ระบบใหม่" };

  const supabase = await createClient();
  const current = await ownTask(supabase, auth.employeeCode, taskId);
  if (!current) return { ok: false, error: "ไม่พบงานนี้" };
  if (!!current.done === done) return { ok: true };

  const { error } = await supabase
    .from("tasks")
    .update({ done })
    .eq("id", taskId)
    .eq("employee_code", auth.employeeCode);
  if (error) return { ok: false, error: error.message };

  const syncError = await syncActivity(
    supabase,
    auth.employeeCode,
    current,
    done,
    auth.permissions.includes("activity.log"),
    opts
  );
  if (syncError) {
    // The activity is the point of ticking an action-linked task. If it cannot be written,
    // put the tick back rather than leaving a task that looks logged but counted nothing.
    await supabase
      .from("tasks")
      .update({ done: !done })
      .eq("id", taskId)
      .eq("employee_code", auth.employeeCode);
    return { ok: false, error: syncError };
  }

  await writeAudit(
    supabase,
    auth.employeeCode,
    taskId,
    done ? "complete" : "reopen",
    { done: !!current.done },
    { done, activity_type: current.activity_type }
  );
  revalidate();
  return { ok: true };
}

/** Load another month when the plan navigates outside the range the page shipped with. */
export async function fetchTasksInRange(from: string, to: string): Promise<Task[]> {
  const auth = await requireAuth();
  if (!auth) return [];
  return readTasks(auth.employeeCode, from, to);
}

// ── Quick Add presets ────────────────────────────────────────────────────────
// Per-user, and now per-user IN THE DATABASE rather than localStorage — the design build
// keyed them by nickname in the browser, so they vanished on another device and could not
// be validated against `action_type` (which `user_quick_actions.activity_type` FKs to).

export interface QuickActionInput {
  label: string;
  type: TaskType;
  activityType?: string | null;
}

export async function saveQuickActions(actions: QuickActionInput[]): Promise<Result> {
  const auth = await requireAuth();
  if (!auth) return { ok: false, error: "ไม่พบสิทธิ์ผู้ใช้ กรุณาเข้าสู่ระบบใหม่" };

  const supabase = await createClient();
  const { error: delError } = await supabase
    .from("user_quick_actions")
    .delete()
    .eq("employee_code", auth.employeeCode);
  if (delError) return { ok: false, error: delError.message };

  const rows = actions
    .filter((a) => a.label.trim())
    .map((a, i) => ({
      employee_code: auth.employeeCode,
      label: a.label.trim(),
      task_type: a.type,
      activity_type: a.activityType || null,
      sort_order: i,
    }));

  if (rows.length) {
    const { error } = await supabase.from("user_quick_actions").insert(rows);
    if (error) return { ok: false, error: error.message };
  }

  revalidate();
  return { ok: true };
}
