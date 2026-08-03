// Quick Add — one-tap presets that drop a common task into the day's plan.
//
// CEO feedback R1 item 4: the +บันทึก FAB is gone, so the Daily Plan is now the only way
// work gets recorded. Quick Add is what keeps that fast — instead of typing "โทรหาลูกค้า"
// every morning, a sale taps a chip. Time / notes / linked lead can be filled in after.
//
// PER-USER, not company-wide (Ben: "ที่ user สามารถ set เองได้ ตาม preferences ของเขา").
// Persisted to localStorage keyed by agent — same approach the leads table already uses for
// its column order. Wire later: `user_quick_actions(user_id, label, task_type,
// activity_type, sort_order)`.
//
// A preset is a SHORTCUT over vocabularies that already exist — `activityType` values come
// from ACTION_GROUPS (lib/actions) and `type` from TASK_TYPES (lib/momentum). Quick Add
// introduces no new vocabulary of its own.

import type { TaskType } from "@/lib/momentum";

export interface QuickAction {
  id: string;
  label: string;
  type: TaskType;
  /** Links the created task to the activity log — ticking it records this action. */
  activityType?: string;
}

// Default set for a sales rep — the actions the KPI targets and the new-sales rank ladder
// actually count (Call / Show / Owner Visit / Survey / Sourcing).
export const DEFAULT_QUICK_ACTIONS: QuickAction[] = [
  { id: "qa_call", label: "โทรหาลูกค้า", type: "build", activityType: "Call" },
  { id: "qa_show", label: "พาชม", type: "build", activityType: "Show" },
  { id: "qa_owner", label: "เยี่ยมเจ้าของ", type: "build", activityType: "Owner Visit" },
  { id: "qa_survey", label: "สำรวจทรัพย์", type: "build", activityType: "Survey" },
  { id: "qa_sourcing", label: "หาทรัพย์ใหม่", type: "build", activityType: "Sourcing" },
];

const KEY_PREFIX = "haus.quickActions.";

export function loadQuickActions(agent: string): QuickAction[] {
  if (typeof window === "undefined") return DEFAULT_QUICK_ACTIONS;
  try {
    const raw = localStorage.getItem(KEY_PREFIX + agent);
    if (!raw) return DEFAULT_QUICK_ACTIONS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_QUICK_ACTIONS;
    // Tolerate hand-edited / older payloads rather than throwing away the whole set.
    return parsed.filter(
      (x): x is QuickAction => !!x && typeof x.id === "string" && typeof x.label === "string"
    );
  } catch {
    return DEFAULT_QUICK_ACTIONS;
  }
}

export function saveQuickActions(agent: string, actions: QuickAction[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY_PREFIX + agent, JSON.stringify(actions));
  } catch {
    /* quota / private mode — chips just fall back to defaults next load */
  }
}
