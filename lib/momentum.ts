// The Momentum layer (Daily Plan + Targets) — types and pure helpers only.
//
// Phase 5 #6 emptied this file of sample data. `tasks` and `targets` are real tables now
// (lib/plan.ts reads them, lib/mutations/tasks.ts + targets.ts write them), so ids are the
// DB's bigints rather than strings minted in the browser, and everything is keyed by
// `employee_code` rather than a nickname.
//
// The bridge to the CRM is still the activity log: an activity-source target's progress is
// summed from `activities`, and the only thing that writes an activity is ticking a task
// that carries an `activityType`.

/**
 * @deprecated The stubbed "today" from the design build. Still exported because the pages
 * that remain on seed data (leave, new-sales, notifications, probation) date their sample
 * rows around it, and moving them to a real clock would silently blank those screens. The
 * wired surfaces use `todayISO()`. Phase 6 removes this along with the seeds.
 */
export const TODAY = "2026-07-13";

/** Real today, in the local timezone, as YYYY-MM-DD. */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The YYYY-MM a date belongs to. */
export const monthOf = (iso: string): string => iso.slice(0, 7);

/** Shift an ISO date by n days. Parsed and formatted in UTC so it never drifts a day. */
export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** First and last day of a YYYY-MM, inclusive — the range a month's task query covers. */
export function monthBounds(ym: string): { from: string; to: string } {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, "0")}` };
}

// Awareness split (Solo Gang's building/working/personal, cut for sales).
export type TaskType = "build" | "work" | "personal";
// Task-type colours map to the Solo Gang "Momentum" awareness triad on /today (see
// .plan-theme in globals.css): build=accent(emerald), work=blue(indigo), personal=violet(rose).
export const TASK_TYPES: Record<TaskType, { label: string; tone: "accent" | "blue" | "violet" }> = {
  build: { label: "สร้างยอด", tone: "accent" },
  work: { label: "พื้นฐาน", tone: "blue" },
  personal: { label: "ส่วนตัว", tone: "violet" },
};
export const TASK_TYPE_ORDER: TaskType[] = ["build", "work", "personal"];

/** Guards a value read back from the DB, where `task_type` is a plain text column. */
export function asTaskType(v: string | null | undefined): TaskType {
  return v === "build" || v === "work" || v === "personal" ? v : "work";
}

// "ratio" = a %-of-total KPI (numerator ÷ denominator, goal 100%) — e.g. Owner Talk,
// Buyer Follow. manualCurrent holds the numerator; `denominator` holds the total.
export type TargetKind = "count" | "baht" | "check" | "ratio";
// "kpi" = one of the leadership-defined sales-process KPIs. Its value is entered/rolled up
// rather than counted from the raw activity log — ratio KPIs need a denominator the
// activity count alone can't give.
export type TargetSource = "activity" | "pipeline" | "manual" | "kpi";
export type TargetOwner = "official" | "stretch";

export interface Target {
  id: number;
  employeeCode: string;
  month: string; // YYYY-MM
  label: string;
  kind: TargetKind;
  /** count/baht: the goal number. ratio: the % goal (100). check: 1. */
  target: number;
  /** Stored progress for pipeline/manual/kpi sources (activity source is computed live).
   *  For kind="ratio" this is the numerator (done); pair it with `denominator`. */
  manualCurrent: number;
  /** kind="ratio" only: the denominator (the total universe). pct = manualCurrent ÷ denominator. */
  denominator?: number;
  source: TargetSource;
  /** For source="activity": the CRM action whose logged count feeds this target.
   *  For source="kpi": the related activity action (informational). */
  activityType?: string;
  owner: TargetOwner;
  /** KPI weekly-focus rhythm (leadership pacing): this KPI is the focus in weeks
   *  focusWeekStart..focusWeekEnd of the month. Absent = no rhythm (plain goal). */
  focusWeekStart?: number;
  focusWeekEnd?: number;
  /** Short display for the focus window, e.g. "สัปดาห์ 2-3". */
  focusLabel?: string;
}

export type RecurFreq = "none" | "daily" | "weekdays" | "weekly" | "monthly";

export interface TaskRepeat {
  freq: RecurFreq;
  weekdays?: number[]; // JS getDay() 0=Sun..6=Sat, for "weekly"
  dayOfMonth?: number; // 1..31, for "monthly"
}

export interface Task {
  id: number;
  employeeCode: string;
  date: string;
  title: string;
  done: boolean;
  order: number;
  type: TaskType;
  /** Advanced: free-text detail. */
  notes?: string;
  /** Links this task to a monthly target. */
  targetId?: number;
  /** CRM activity logged on completion (drives the auto-bridge). */
  activityType?: string;
  relatedLeadId?: string;
  /** Display only — joined from main_6_buyer_crm, not a column on `tasks`. */
  relatedLeadName?: string;
  relatedListingId?: string;
  /** Display only — joined from v_main_listing, not a column on `tasks`. */
  relatedListingName?: string;
  /** Advanced: optional scheduled time (HH:MM). */
  startTime?: string;
  endTime?: string;
  /** Advanced: recurrence rule (captured, not yet expanded to instances). */
  repeat?: TaskRepeat | null;
}

export const RECUR_FREQ: Record<RecurFreq, { label: string }> = {
  none: { label: "ไม่ซ้ำ" },
  daily: { label: "ทุกวัน" },
  weekdays: { label: "จ–ศ" },
  weekly: { label: "ทุกสัปดาห์" },
  monthly: { label: "ทุกเดือน" },
};
export const RECUR_ORDER: RecurFreq[] = ["none", "daily", "weekdays", "weekly", "monthly"];
export const WEEKDAY_LABELS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon-first display

/** Monthly totals per action for one person: `{ "Call": 12, "Show": 3 }`.
 *  Built server-side (lib/plan.ts) so the whole activity log never reaches the browser. */
export type ActivityTotals = Record<string, number>;

/** Activity-source targets read their `current` live from the activity totals. Everything
 *  else (pipeline/manual/kpi) returns the stored value — for kpi/ratio that's the numerator. */
export function targetCurrent(t: Target, totals: ActivityTotals): number {
  if (t.source !== "activity" || !t.activityType) return t.manualCurrent;
  return totals[t.activityType] ?? 0;
}

/** Auto targets update themselves from the system (activity log, aggregated KPI tab, or
 *  derived pipeline/revenue) — no manual +1. Only `manual` targets get the +1 button. */
export function isAutoTarget(t: Target): boolean {
  return t.source !== "manual";
}

/** Unified progress for any kind. For ratio, denom is the total and pct = current ÷ total;
 *  otherwise denom is the goal number and pct = current ÷ target. */
export function targetProgress(
  t: Target,
  totals: ActivityTotals
): { current: number; denom: number; pct: number } {
  const current = targetCurrent(t, totals);
  const denom = t.kind === "ratio" ? t.denominator ?? 0 : t.target;
  const pct = denom > 0 ? Math.min(100, Math.round((current / denom) * 100)) : 0;
  return { current, denom, pct };
}

/** Week of the month for the KPI focus rhythm: 1–7=w1, 8–14=w2, 15–21=w3, 22+=w4. */
export function currentWeekOfMonth(iso: string = todayISO()): number {
  const day = Number(iso.slice(8, 10));
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  return 4;
}

/** Is this KPI the leadership focus for the given week? */
export function isFocusWeek(t: Target, week: number = currentWeekOfMonth()): boolean {
  if (t.focusWeekStart == null || t.focusWeekEnd == null) return false;
  return week >= t.focusWeekStart && week <= t.focusWeekEnd;
}
