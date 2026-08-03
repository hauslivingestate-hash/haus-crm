// SAMPLE DATA + logic — the Momentum layer (Daily Plan + Targets), adapted from Solo Gang.
// The bridge to the CRM is the activity log: activity-source targets auto-track from it
// (hybrid — non-activity targets use a manual +1). Decided owners: manager sets the
// "official" target, agent adds "stretch" goals. Wire later = `targets` + `tasks` tables;
// activity-source `current` becomes an aggregation over the real activities table.

import { listActivities, type Activity } from "@/lib/actions";

export const TODAY = "2026-07-13"; // stubbed "today" for the design build
const MONTH = "2026-07";
const SAMPLE_AGENT = "Stone"; // the representative agent whose plan/targets we show

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

// "ratio" = a %-of-total KPI (numerator ÷ denominator, goal 100%) — e.g. Owner Talk,
// Buyer Follow. manualCurrent holds the numerator; `denominator` holds the total.
export type TargetKind = "count" | "baht" | "check" | "ratio";
// "kpi" = one of the leadership-defined sales-process KPIs, aggregated from the
// summary_kpi tab at wiring (not from the raw activity log — ratio KPIs need a
// denominator the activity count alone can't give).
export type TargetSource = "activity" | "pipeline" | "manual" | "kpi";
export type TargetOwner = "official" | "stretch";

export interface Target {
  id: string;
  agent: string;
  month: string;
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
   *  For source="kpi": the related activity action (informational — the KPI value
   *  itself comes from summary_kpi, but this documents the driving behaviour). */
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
  id: string;
  agent: string;
  date: string;
  title: string;
  done: boolean;
  order: number;
  type: TaskType;
  /** Advanced: free-text detail. */
  notes?: string;
  /** Links this task to a monthly target. */
  targetId?: string;
  /** CRM activity logged on completion (drives the auto-bridge). */
  activityType?: string;
  relatedLeadId?: string;
  relatedLeadName?: string;
  relatedListingId?: string;
  relatedListingName?: string;
  /** Advanced: optional scheduled time (HH:MM). */
  startTime?: string;
  endTime?: string;
  /** Advanced: recurrence rule (design-first: captured, not yet expanded to instances). */
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

const TARGETS: Target[] = [
  // Official — the 4 leadership-defined sales-process KPIs (from the HAUS dashboard's
  // summary_kpi). Each has a weekly-focus window (which KPI to push that week). Owner
  // Talk & Buyer Follow are ratios (% of a universe); Sourcing & Survey are counts.
  { id: "k_ownertalk", agent: SAMPLE_AGENT, month: MONTH, label: "Owner Talk", kind: "ratio", target: 100, manualCurrent: 9, denominator: 12, source: "kpi", activityType: "Owner Visit", owner: "official", focusWeekStart: 1, focusWeekEnd: 1, focusLabel: "สัปดาห์ 1" },
  { id: "k_sourcing", agent: SAMPLE_AGENT, month: MONTH, label: "Sourcing", kind: "count", target: 10, manualCurrent: 6, source: "kpi", activityType: "Sourcing", owner: "official", focusWeekStart: 2, focusWeekEnd: 3, focusLabel: "สัปดาห์ 2-3" },
  { id: "k_survey", agent: SAMPLE_AGENT, month: MONTH, label: "Survey", kind: "count", target: 8, manualCurrent: 5, source: "kpi", activityType: "Survey", owner: "official", focusWeekStart: 2, focusWeekEnd: 3, focusLabel: "สัปดาห์ 2-3" },
  { id: "k_buyerfollow", agent: SAMPLE_AGENT, month: MONTH, label: "Buyer Follow", kind: "ratio", target: 100, manualCurrent: 22, denominator: 30, source: "kpi", activityType: "Follow", owner: "official", focusWeekStart: 4, focusWeekEnd: 4, focusLabel: "สัปดาห์ 4" },
  // Stretch — added by the agent.
  { id: "t_reels", agent: SAMPLE_AGENT, month: MONTH, label: "ถ่าย Reels", kind: "count", target: 6, manualCurrent: 0, source: "activity", activityType: "Reels", owner: "stretch" },
  { id: "t_source", agent: SAMPLE_AGENT, month: MONTH, label: "หาทรัพย์ใหม่", kind: "count", target: 10, manualCurrent: 0, source: "activity", activityType: "Sourcing", owner: "stretch" },
];

const TASKS: Task[] = [
  // Today
  { id: "k1", agent: SAMPLE_AGENT, date: TODAY, title: "โทรหา คุณเบิร์ด ตามเรื่องต่อรอง", done: false, order: 0, type: "build", targetId: "k_buyerfollow", activityType: "Call", relatedLeadId: "L-0011", relatedLeadName: "คุณเบิร์ด" },
  { id: "k2", agent: SAMPLE_AGENT, date: TODAY, title: "พาชม ชัยพฤกษ์ กับ คุณมีน", done: false, order: 1, type: "build", activityType: "Show", relatedLeadId: "L-0007", relatedLeadName: "คุณมีน" },
  { id: "k3", agent: SAMPLE_AGENT, date: TODAY, title: "เยี่ยมเจ้าของ อโศก คุยราคาใหม่", done: true, order: 2, type: "build", targetId: "k_ownertalk", activityType: "Owner Visit", relatedListingId: "CASK001", relatedListingName: "Asoke Sky Residence" },
  { id: "k4", agent: SAMPLE_AGENT, date: TODAY, title: "อัพเดทพอร์ทัล Rama 2", done: false, order: 3, type: "work" },
  { id: "k5", agent: SAMPLE_AGENT, date: TODAY, title: "ออกกำลังกาย", done: false, order: 4, type: "personal" },
  // Yesterday
  { id: "k6", agent: SAMPLE_AGENT, date: "2026-07-12", title: "ถ่าย Reels เดอะ เนิน", done: true, order: 0, type: "build", targetId: "t_reels", activityType: "Reels", relatedListingId: "CBGY001", relatedListingName: "The Nern by Sansiri" },
  { id: "k7", agent: SAMPLE_AGENT, date: "2026-07-12", title: "ประชุมทีมเช้า", done: true, order: 1, type: "work" },
  // Tomorrow
  { id: "k8", agent: SAMPLE_AGENT, date: "2026-07-14", title: "หาทรัพย์ใหม่ ย่านราชพฤกษ์", done: false, order: 0, type: "build", targetId: "t_source", activityType: "Sourcing" },
];

export function currentAgent(): string {
  return SAMPLE_AGENT;
}

/** Activity-source targets read their `current` live from the activity log. Everything
 *  else (pipeline/manual/kpi) returns the stored value — for kpi/ratio that's the
 *  numerator, wired later to a summary_kpi aggregation. */
export function targetCurrent(t: Target, activities: Activity[] = listActivities()): number {
  if (t.source !== "activity" || !t.activityType) return t.manualCurrent;
  return activities
    .filter((a) => a.created_by === t.agent && a.action === t.activityType && a.date.startsWith(t.month))
    .reduce((sum, a) => sum + a.count, 0);
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
  activities?: Activity[]
): { current: number; denom: number; pct: number } {
  const current = targetCurrent(t, activities);
  const denom = t.kind === "ratio" ? t.denominator ?? 0 : t.target;
  const pct = denom > 0 ? Math.min(100, Math.round((current / denom) * 100)) : 0;
  return { current, denom, pct };
}

export function targetPct(t: Target, current?: number): number {
  const cur = current ?? targetCurrent(t);
  const denom = t.kind === "ratio" ? t.denominator ?? 0 : t.target;
  if (denom <= 0) return 0;
  return Math.min(100, Math.round((cur / denom) * 100));
}

/** Week of the month for the KPI focus rhythm: 1–7=w1, 8–14=w2, 15–21=w3, 22+=w4.
 *  Derived from the stubbed TODAY so the design is stable; swap to a real clock at wiring. */
export function currentWeekOfMonth(iso: string = TODAY): number {
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

export function listTargets(agent: string = SAMPLE_AGENT): Target[] {
  return TARGETS.filter((t) => t.agent === agent && t.month === MONTH);
}

export function listTasks(agent: string = SAMPLE_AGENT): Task[] {
  return TASKS.filter((t) => t.agent === agent);
}

export function getTasksForDate(date: string, agent: string = SAMPLE_AGENT): Task[] {
  return TASKS.filter((t) => t.agent === agent && t.date === date).sort((a, b) => a.order - b.order);
}

export function getTarget(id: string | undefined): Target | undefined {
  return id ? TARGETS.find((t) => t.id === id) : undefined;
}

/** Dates (this design month) that have at least one task — for the mini date strip. */
export function taskDates(agent: string = SAMPLE_AGENT): string[] {
  return Array.from(new Set(TASKS.filter((t) => t.agent === agent).map((t) => t.date))).sort();
}

export function donePct(tasks: Task[]): number {
  if (tasks.length === 0) return 0;
  return Math.round((tasks.filter((t) => t.done).length / tasks.length) * 100);
}
