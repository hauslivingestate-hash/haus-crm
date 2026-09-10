import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import {
  addDays,
  asTaskType,
  monthBounds,
  monthOf,
  todayISO,
  type ActivityTotals,
  type RecurFreq,
  type Target,
  type TargetKind,
  type TargetOwner,
  type TargetSource,
  type Task,
} from "@/lib/momentum";
import type { AttachMode } from "@/lib/actions";

// Server reads for /today (Phase 5 #6). Everything here is scoped to ONE person — the
// signed-in employee. The design build keyed all of it off a nickname ("Stone") and a
// stubbed TODAY; both are gone.
//
// ⚠️ Every query filters `employee_code` EXPLICITLY rather than leaning on RLS. RLS is a
// ceiling, not a filter: `tasks`/`targets` also admit `roles.manage`, and `activities` also
// admits `performance.view_team`. Without the explicit filter, an admin's plan would show
// the whole company's tasks and a team lead's stretch goals would count their team's
// activity as their own.

export interface QuickActionRow {
  id: number;
  label: string;
  type: Task["type"];
  activityType?: string;
}

export interface ActionGroupRow {
  group: string;
  attach: AttachMode;
  items: string[];
}

export interface PlanData {
  employeeCode: string;
  nickname: string;
  today: string;
  month: string;
  /** Tasks for `month`, plus one day either side so the ◀ ▶ arrows work across month ends. */
  tasks: Task[];
  /** รายการรอ — every undated task, regardless of month. A backlog is not a property of
   *  the month you happen to be looking at, and paging it by month would hide the pile. */
  backlog: Task[];
  targets: Target[];
  quickActions: QuickActionRow[];
  /** This month's activity totals per action, for activity-source targets. */
  activityTotals: ActivityTotals;
  /** This month's SIGNED commission, for revenue-source targets. Counted on closing_date
   *  and excluding statuses flagged counts_as_revenue = false — the same rule the
   *  dashboard uses, via the same RPC, so the two screens cannot disagree. */
  monthRevenue: number;
  /** The governed action vocabulary, from `action_type` — NOT the seed list, which is
   *  missing three rows that exist in the table and are FK-valid (Owner Talk, Update
   *  Price, เซ็นสัญญา). `tasks.activity_type` and `activities.action` are both FKs to it. */
  actionGroups: ActionGroupRow[];
  canLog: boolean;
  canStretch: boolean;
  canSetOfficial: boolean;
}

type TaskRow = {
  id: number;
  employee_code: string;
  task_date: string;
  title: string;
  done: boolean | null;
  sort_order: number | null;
  task_type: string | null;
  notes: string | null;
  target_id: number | null;
  activity_type: string | null;
  related_lead_id: string | null;
  related_listing_id: string | null;
  start_time: string | null;
  end_time: string | null;
  repeat_freq: string | null;
  repeat_weekdays: number[] | null;
  repeat_day_of_month: number | null;
};

/** Postgres `time` comes back as HH:MM:SS; <input type="time"> wants HH:MM. */
const hhmm = (t: string | null): string | undefined => (t ? t.slice(0, 5) : undefined);

const REPEAT_FREQS: RecurFreq[] = ["daily", "weekdays", "weekly", "monthly"];

function toTask(
  r: TaskRow,
  leadNames: Map<string, string>,
  listingNames: Map<string, string>
): Task {
  const freq = REPEAT_FREQS.find((f) => f === r.repeat_freq);
  return {
    id: r.id,
    employeeCode: r.employee_code,
    date: r.task_date,
    title: r.title,
    done: !!r.done,
    order: r.sort_order ?? 0,
    type: asTaskType(r.task_type),
    notes: r.notes ?? undefined,
    targetId: r.target_id ?? undefined,
    activityType: r.activity_type ?? undefined,
    relatedLeadId: r.related_lead_id ?? undefined,
    relatedLeadName: r.related_lead_id ? leadNames.get(r.related_lead_id) : undefined,
    relatedListingId: r.related_listing_id ?? undefined,
    relatedListingName: r.related_listing_id ? listingNames.get(r.related_listing_id) : undefined,
    startTime: hhmm(r.start_time),
    endTime: hhmm(r.end_time),
    repeat: freq
      ? {
          freq,
          weekdays: r.repeat_weekdays ?? undefined,
          dayOfMonth: r.repeat_day_of_month ?? undefined,
        }
      : null,
  };
}

/**
 * Resolve display names for the leads/listings tasks point at.
 *
 * They are not columns on `tasks` — only the FK ids are stored — and a listing's name lives
 * two joins away (main_4 → main_3.project_name_thai, surfaced by v_main_listing), so a
 * PostgREST embed on the FK target would come back nameless. Two small `in` queries instead.
 */
async function resolveEntityNames(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: TaskRow[]
): Promise<{ leadNames: Map<string, string>; listingNames: Map<string, string> }> {
  const leadIds = [...new Set(rows.map((r) => r.related_lead_id).filter(Boolean))] as string[];
  const listingIds = [...new Set(rows.map((r) => r.related_listing_id).filter(Boolean))] as string[];

  const [leads, listings] = await Promise.all([
    leadIds.length
      ? supabase.from("main_6_buyer_crm").select("lead_id,lead_name").in("lead_id", leadIds)
      : Promise.resolve({ data: [] }),
    listingIds.length
      ? supabase.from("v_main_listing").select("listing_id,listing_name").in("listing_id", listingIds)
      : Promise.resolve({ data: [] }),
  ]);

  return {
    leadNames: new Map(
      ((leads.data ?? []) as { lead_id: string; lead_name: string | null }[]).map(
        (l) => [l.lead_id, l.lead_name ?? l.lead_id] as const
      )
    ),
    listingNames: new Map(
      ((listings.data ?? []) as { listing_id: string; listing_name: string | null }[]).map(
        (l) => [l.listing_id, l.listing_name ?? l.listing_id] as const
      )
    ),
  };
}

/** One person's tasks in a date range, ordered the way the plan renders them. */
export async function readTasks(
  employeeCode: string,
  from: string,
  to: string
): Promise<Task[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select("*")
    .eq("employee_code", employeeCode)
    .gte("task_date", from)
    .lte("task_date", to)
    .order("task_date")
    .order("sort_order");
  const rows = (data ?? []) as TaskRow[];
  if (!rows.length) return [];
  const { leadNames, listingNames } = await resolveEntityNames(supabase, rows);
  return rows.map((r) => toTask(r, leadNames, listingNames));
}

/** One person's undated tasks — รายการรอ. Its own function rather than a null `from`/`to`
    on readTasks: `gte`/`lte` can never match a NULL, so the two are different queries and
    a shared one would have to branch on its own arguments to decide which. */
export async function readBacklog(employeeCode: string): Promise<Task[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select("*")
    .eq("employee_code", employeeCode)
    .is("task_date", null)
    .order("sort_order");
  const rows = (data ?? []) as TaskRow[];
  if (!rows.length) return [];
  const { leadNames, listingNames } = await resolveEntityNames(supabase, rows);
  return rows.map((r) => toTask(r, leadNames, listingNames));
}

type TargetRow = {
  id: number;
  employee_code: string;
  month: string;
  label: string;
  kind: string;
  target: number | string;
  manual_current: number | string | null;
  denominator: number | string | null;
  source: string;
  activity_type: string | null;
  owner: string;
  focus_week_start: number | null;
  focus_week_end: number | null;
  focus_label: string | null;
};

// `numeric` arrives as a string over PostgREST — Number() it or every progress bar reads 0.
const num = (v: number | string | null, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

function toTarget(r: TargetRow): Target {
  return {
    id: r.id,
    employeeCode: r.employee_code,
    month: r.month,
    label: r.label,
    kind: (["count", "baht", "check", "ratio"] as TargetKind[]).find((k) => k === r.kind) ?? "count",
    target: num(r.target),
    manualCurrent: num(r.manual_current),
    denominator: r.denominator == null ? undefined : num(r.denominator),
    source:
      (["activity", "pipeline", "manual", "kpi"] as TargetSource[]).find((s) => s === r.source) ??
      "manual",
    activityType: r.activity_type ?? undefined,
    owner: (r.owner === "official" ? "official" : "stretch") as TargetOwner,
    focusWeekStart: r.focus_week_start ?? undefined,
    focusWeekEnd: r.focus_week_end ?? undefined,
    focusLabel: r.focus_label ?? undefined,
  };
}

/** One person's targets for a month. */
export async function readTargets(employeeCode: string, month: string): Promise<Target[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("targets")
    .select("*")
    .eq("employee_code", employeeCode)
    .eq("month", month)
    .order("owner")
    .order("id");
  return ((data ?? []) as TargetRow[]).map(toTarget);
}

/** Everything /today renders, for the signed-in user. Null when there is no employee row. */
export async function getPlanData(month?: string): Promise<PlanData | null> {
  const auth = await getAuthContext();
  if (!auth?.employeeCode) return null;
  const employeeCode = auth.employeeCode;

  const today = todayISO();
  const ym = month ?? monthOf(today);
  const { from, to } = monthBounds(ym);

  const supabase = await createClient();
  const [taskRes, backlogRes, targetRes, quickRes, actionRes, activityRes, revenueRes] =
    await Promise.all([
    // ± a day so stepping off either end of the month still renders before the client
    // fetches the neighbouring month.
    supabase
      .from("tasks")
      .select("*")
      .eq("employee_code", employeeCode)
      .gte("task_date", addDays(from, -1))
      .lte("task_date", addDays(to, 1))
      .order("task_date")
      .order("sort_order"),
    // The backlog, whole. Not paged by month — see PlanData.backlog.
    supabase
      .from("tasks")
      .select("*")
      .eq("employee_code", employeeCode)
      .is("task_date", null)
      .order("sort_order"),
    supabase
      .from("targets")
      .select("*")
      .eq("employee_code", employeeCode)
      .eq("month", ym)
      .order("owner")
      .order("id"),
    supabase
      .from("user_quick_actions")
      .select("*")
      .eq("employee_code", employeeCode)
      .order("sort_order")
      .order("id"),
    supabase
      .from("action_type")
      .select("name,group_label,attach,sort_order")
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("activities")
      .select("action,count")
      .eq("employee_code", employeeCode)
      .gte("activity_date", from)
      .lte("activity_date", to),
    // The same RPC the dashboard's revenue card calls, over the same month. Sharing the
    // read is the point: "how much did I sign this month" must be one number, computed
    // once, or แผนวันนี้ and แดชบอร์ด quietly disagree about the same goal.
    supabase.rpc("dash_revenue_monthly", {
      p_sale_id: employeeCode,
      p_from: from,
      p_to: to,
      // Explicit, not defaulted: a revenue goal on แผนวันนี้ measures what was SOLD this
      // month, which is the same basis the dashboard opens on. Leaning on the function's
      // default would leave this screen silently following a change made for that one.
      p_basis: "close",
    }),
  ]);

  const taskRows = (taskRes.data ?? []) as TaskRow[];
  const backlogRows = (backlogRes.data ?? []) as TaskRow[];
  // Names resolved for both lists in one pass — a backlog item can be linked to a lead
  // just as a planned one can, and two calls would be two round trips for one map.
  const { leadNames, listingNames } = await resolveEntityNames(supabase, [
    ...taskRows,
    ...backlogRows,
  ]);

  // One row per month; the window is one month, so this is a sum of at most one row.
  // Written as a reduce anyway so a widened window cannot silently read only the first.
  const monthRevenue = ((revenueRes.data ?? []) as { total: number }[]).reduce(
    (sum, r) => sum + Number(r.total ?? 0),
    0
  );

  const activityTotals: ActivityTotals = {};
  for (const a of (activityRes.data ?? []) as { action: string; count: number }[]) {
    activityTotals[a.action] = (activityTotals[a.action] ?? 0) + (a.count ?? 1);
  }

  // Preserve the table's sort_order when grouping, so the dropdown reads in business order
  // rather than however the rows happened to arrive.
  const actionGroups: ActionGroupRow[] = [];
  for (const a of (actionRes.data ?? []) as {
    name: string;
    group_label: string;
    attach: string;
  }[]) {
    let g = actionGroups.find((x) => x.group === a.group_label);
    if (!g) {
      g = { group: a.group_label, attach: (a.attach as AttachMode) ?? "none", items: [] };
      actionGroups.push(g);
    }
    g.items.push(a.name);
  }

  const perms = new Set(auth.permissions);
  return {
    employeeCode,
    nickname: auth.nickname ?? employeeCode,
    today,
    month: ym,
    tasks: taskRows.map((r) => toTask(r, leadNames, listingNames)),
    backlog: backlogRows.map((r) => toTask(r, leadNames, listingNames)),
    targets: ((targetRes.data ?? []) as TargetRow[]).map(toTarget),
    monthRevenue,
    quickActions: ((quickRes.data ?? []) as {
      id: number;
      label: string;
      task_type: string | null;
      activity_type: string | null;
    }[]).map((q) => ({
      id: q.id,
      label: q.label,
      type: asTaskType(q.task_type),
      activityType: q.activity_type ?? undefined,
    })),
    activityTotals,
    actionGroups,
    canLog: perms.has("activity.log") || perms.has("roles.manage"),
    canStretch: perms.has("targets.stretch") || perms.has("roles.manage"),
    canSetOfficial: perms.has("targets.set") || perms.has("roles.manage"),
  };
}
