// Quick Add — one-tap presets that drop a common task into the day's plan.
//
// CEO feedback R1 item 4: the +บันทึก FAB is gone, so the Daily Plan is now the only way
// work gets recorded. Quick Add is what keeps that fast — instead of typing "โทรหาลูกค้า"
// every morning, a sale taps a chip. Time / notes / linked lead can be filled in after.
//
// PER-USER (Ben: "ที่ user สามารถ set เองได้ ตาม preferences ของเขา"). Phase 5 #6 moved the
// storage from localStorage to `user_quick_actions`, so a preset follows the person to
// another device and its `activity_type` is FK-checked against `action_type`. What remains
// here is only the starting set for someone who has never customised theirs.
//
// A preset is a SHORTCUT over vocabularies that already exist — `activityType` values come
// from `action_type` and `type` from TASK_TYPES (lib/momentum). Quick Add introduces no new
// vocabulary of its own.

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
