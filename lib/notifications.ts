// SAMPLE DATA — in-app notifications (the Topbar bell).
//
// Model is deliberately LEAN and per-recipient: a row is self-contained (the Thai copy is
// stored as written at creation time) plus an optional deep link to the entity that caused
// it. Wire later = a `notifications` table with RLS `user_id = auth.uid()` — a notification
// is private to its recipient, so scoping is the whole security model here.
//
// Tradeoff of storing rendered text: copy edits do NOT retro-apply to old rows, and the
// text freezes the values as they were (a "งบ 6 ล้าน" notice keeps saying 6 ล้าน after the
// budget changes). That's usually what you want for an audit-ish feed, and it keeps the
// row readable without joins — but it means changing wording later needs a backfill.
//
// NOT built (decided 2026-07-15): LINE push. `Employee.lineUserId` exists in the HR Sheet,
// so if the client ever wants it, this table needs `channel` + `delivered_at` columns and
// a LINE Messaging API worker. Chosen to stay lean now — see HANDOVER_CHECKLIST.md.
//
// Entity ids below are REAL (main_6_buyer_crm / v_main_listing) so deep links resolve.

import {
  UserPlus,
  TrendingUp,
  Trophy,
  CalendarCheck,
  Target,
  Building2,
  TagIcon,
  type LucideIcon,
} from "lucide-react";
import { TODAY } from "@/lib/momentum";
import { TH_MONTHS } from "@/lib/format";

/** Stubbed "now" for the design build — same clock as the Momentum layer's TODAY. */
export const NOW = `${TODAY}T16:20:00+07:00`;

/** The `type` enum. Adding one = a new row in this union + NOTIFICATION_META. */
export type NotificationType =
  | "lead_assigned"
  | "lead_stage_changed"
  | "deal_won"
  | "task_due"
  | "target_milestone"
  | "listing_new_in_zone"
  | "listing_price_changed";

export type NotificationEntity = "lead" | "listing" | "task" | "target";

export interface AppNotification {
  id: string;
  /** Recipient — mirrors rbac OrgUser.id / Employee.id (the login), NOT Employee.code.
   *  Source rows key agents by `sale_id` (= Employee.code, e.g. "S-001"), so the wiring
   *  must join sale_id → employees.code → employees.id to address a notification. */
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  /** Deep link target; omit for a notification with nowhere to go. */
  entity?: NotificationEntity;
  entityId?: string;
  /** Nickname of whoever caused it; omit for system-generated (due dates, milestones). */
  actor?: string;
  createdAt: string; // ISO 8601
  /** null/undefined = unread. */
  readAt?: string | null;
}

export const NOTIFICATION_META: Record<
  NotificationType,
  { label: string; icon: LucideIcon; tone: "accent" | "green" | "amber" | "blue" | "violet" }
> = {
  lead_assigned: { label: "Lead ใหม่", icon: UserPlus, tone: "accent" },
  lead_stage_changed: { label: "ความคืบหน้าดีล", icon: TrendingUp, tone: "blue" },
  deal_won: { label: "ปิดการขาย", icon: Trophy, tone: "green" },
  task_due: { label: "งานวันนี้", icon: CalendarCheck, tone: "amber" },
  target_milestone: { label: "เป้าหมาย", icon: Target, tone: "violet" },
  listing_new_in_zone: { label: "ทรัพย์ใหม่ในโซน", icon: Building2, tone: "blue" },
  listing_price_changed: { label: "ราคาเปลี่ยน", icon: TagIcon, tone: "amber" },
};

/** Where a notification navigates. Task/target have no detail route — they land on the
 *  surface that owns them. Returns null when there's nothing to open. */
export function notificationHref(n: AppNotification): string | null {
  switch (n.entity) {
    case "lead":
      return n.entityId ? `/leads/${n.entityId}` : null;
    case "listing":
      return n.entityId ? `/listings/${n.entityId}` : null;
    case "task":
      return "/today";
    case "target":
      return "/today"; // targets/KPI progress live in the TargetsBoard on แผนวันนี้
    default:
      return null;
  }
}

// Seeded against real leads/listings + each agent's real zoneCodes (lib/team.ts).
// Benz (u_benz) and Pui (u_pui) intentionally have none — they exercise the empty state.
const NOTIFICATIONS: AppNotification[] = [
  // --- Pup (S-001) · zones BGY, SLY ---
  {
    id: "n_001",
    userId: "u_pup",
    type: "lead_assigned",
    title: "คุณได้รับ Lead ใหม่",
    body: "คุณกานดา · งบ 6 ล้าน · สนใจ เดอะ เนิน บางใหญ่",
    entity: "lead",
    entityId: "BC-006",
    actor: "Stone",
    createdAt: `${TODAY}T15:55:00+07:00`,
  },
  {
    id: "n_002",
    userId: "u_pup",
    type: "task_due",
    title: "งานวันนี้ยังไม่เสร็จ 3 รายการ",
    body: "ตามงาน คุณอนันต์ · โทรหาเจ้าของ CBGY002",
    entity: "task",
    createdAt: `${TODAY}T09:00:00+07:00`,
  },
  {
    id: "n_003",
    userId: "u_pup",
    type: "listing_new_in_zone",
    title: "ทรัพย์ใหม่ในโซนบางใหญ่",
    body: "เดอะ เนิน บางใหญ่ · ฿2.2 ล้าน · 2 นอน",
    entity: "listing",
    entityId: "CBGY002",
    actor: "Benz",
    createdAt: "2026-07-12T11:30:00+07:00",
  },
  {
    id: "n_004",
    userId: "u_pup",
    type: "deal_won",
    title: "ปิดการขายได้! คุณรัตนา",
    body: "฿3.9 ล้าน · เดอะ เนิน บางใหญ่",
    entity: "lead",
    entityId: "BC-008",
    createdAt: "2026-07-11T17:05:00+07:00",
    readAt: "2026-07-11T17:40:00+07:00",
  },

  // --- Stone (C-001) · CEO + Agent · zones BGY, RP1 ---
  {
    id: "n_010",
    userId: "u_stone",
    type: "deal_won",
    title: "Q ปิดการขายได้ คุณเมธา",
    body: "฿3.65 ล้าน · ชัยพฤกษ์ ปาร์ค",
    entity: "lead",
    entityId: "BC-007",
    actor: "Q",
    createdAt: `${TODAY}T14:10:00+07:00`,
  },
  {
    id: "n_011",
    userId: "u_stone",
    type: "target_milestone",
    title: "ทีมทำยอดเดือนนี้ถึง 80% แล้ว",
    body: "เหลืออีก 2 ดีลถึงเป้าเดือนกรกฎาคม",
    entity: "target",
    createdAt: `${TODAY}T08:00:00+07:00`,
  },
  {
    id: "n_012",
    userId: "u_stone",
    type: "listing_price_changed",
    title: "เจ้าของลดราคา บ้านกลางเมือง ราชพฤกษ์",
    body: "฿7.2 ล้าน → ฿6.5 ล้าน · โซนราชพฤกษ์ต้น",
    entity: "listing",
    entityId: "TRP1001",
    actor: "Benz",
    createdAt: "2026-07-12T16:45:00+07:00",
  },
  {
    id: "n_013",
    userId: "u_stone",
    type: "lead_stage_changed",
    title: "คุณอนันต์ ขยับไปขั้น เจรจา",
    body: "โดย Pup · งบ 4 ล้าน",
    entity: "lead",
    entityId: "BC-001",
    actor: "Pup",
    createdAt: "2026-07-10T13:20:00+07:00",
    readAt: "2026-07-10T18:00:00+07:00",
  },

  // --- Game (S-002) · zones RM2, PKS ---
  {
    id: "n_020",
    userId: "u_game",
    type: "lead_stage_changed",
    title: "คุณสุดา ขยับไปขั้น พาชม",
    body: "งบ 13 ล้าน · แกรนด์ วิลล่า พระราม 2",
    entity: "lead",
    entityId: "BC-002",
    createdAt: `${TODAY}T11:15:00+07:00`,
  },
  {
    id: "n_021",
    userId: "u_game",
    type: "listing_new_in_zone",
    title: "ทรัพย์ใหม่ในโซนพระราม 2",
    body: "แกรนด์ วิลล่า พระราม 2 · ฿85,000/ด.",
    entity: "listing",
    entityId: "HRM2002",
    actor: "Benz",
    createdAt: "2026-07-12T10:05:00+07:00",
  },

  // --- Q (S-003) · zones CYP, RP1 ---
  {
    id: "n_030",
    userId: "u_q",
    type: "deal_won",
    title: "ปิดการขายได้! คุณเมธา",
    body: "฿3.65 ล้าน · ชัยพฤกษ์ ปาร์ค",
    entity: "lead",
    entityId: "BC-007",
    createdAt: `${TODAY}T14:08:00+07:00`,
  },
  {
    id: "n_031",
    userId: "u_q",
    type: "lead_assigned",
    title: "คุณได้รับ Lead ใหม่",
    body: "คุณพิมพ์ · งบ 3.3 ล้าน · สนใจ ชัยพฤกษ์ ปาร์ค",
    entity: "lead",
    entityId: "BC-004",
    actor: "Stone",
    createdAt: "2026-07-12T09:40:00+07:00",
    readAt: "2026-07-12T10:00:00+07:00",
  },

  // --- Mhow (S-004) · zones ASK, BWK ---
  {
    id: "n_040",
    userId: "u_mhow",
    type: "lead_assigned",
    title: "คุณได้รับ Lead ใหม่",
    body: "คุณเจมส์ · งบ 35,000/ด. · สนใจ อโศก สกาย เรสซิเดนซ์",
    entity: "lead",
    entityId: "BC-003",
    actor: "Stone",
    createdAt: `${TODAY}T13:35:00+07:00`,
  },
  {
    id: "n_041",
    userId: "u_mhow",
    type: "task_due",
    title: "งานวันนี้ยังไม่เสร็จ 2 รายการ",
    body: "ตามงาน คุณวีระ · นัดชม อโศก สกาย",
    entity: "task",
    createdAt: `${TODAY}T09:00:00+07:00`,
  },

  // --- Golf (S-005) · no zones yet ---
  {
    id: "n_050",
    userId: "u_golf",
    type: "target_milestone",
    title: "เป้าเดือนนี้ยังเหลืออีก 40%",
    body: "เหลือ 18 วัน · ทำได้ 6 จาก 10 ดีล",
    entity: "target",
    createdAt: `${TODAY}T08:00:00+07:00`,
  },
];

/** All notifications (design phase). Wiring = select where user_id = auth.uid(). */
export function listNotifications(): AppNotification[] {
  return NOTIFICATIONS;
}

/** Recipient's feed, newest first. */
export function notificationsFor(userId: string): AppNotification[] {
  return NOTIFICATIONS.filter((n) => n.userId === userId).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}

export function unreadCount(items: AppNotification[]): number {
  return items.filter((n) => !n.readAt).length;
}

/** Short relative time in Thai: "เมื่อสักครู่" / "5 นาที" / "2 ชม." under a day, and an
 *  absolute short date ("12 ก.ค.") beyond it.
 *
 *  Deliberately NOT "N วัน" past 24h: elapsed-hours flooring makes a 47-hour-old item read
 *  as "1 วัน" while the panel groups it under ก่อนหน้า (2 calendar days back) — the row
 *  would contradict its own header. The day group already says which day, so the row shows
 *  a date instead of a rounded duration. `now` is injectable so this stays testable. */
export function relativeTimeTh(iso: string, now: string = NOW): string {
  const diffMs = new Date(now).getTime() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "เมื่อสักครู่";
  if (mins < 60) return `${mins} นาที`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ชม.`;
  const d = new Date(iso);
  return `${d.getDate()} ${TH_MONTHS[d.getMonth()]}`;
}

export type DayBucket = "today" | "yesterday" | "earlier";
export const DAY_BUCKET_LABEL: Record<DayBucket, string> = {
  today: "วันนี้",
  yesterday: "เมื่อวาน",
  earlier: "ก่อนหน้า",
};

/** Which day-group a notification falls in, relative to the stubbed clock.
 *  Compares the +07:00 calendar date, so the day math is anchored at noon UTC — using
 *  the raw Date would bucket by the UTC day and mis-group anything before 07:00 Thai. */
export function dayBucket(iso: string, now: string = NOW): DayBucket {
  const day = iso.slice(0, 10);
  const today = now.slice(0, 10);
  if (day === today) return "today";
  const y = new Date(`${today}T12:00:00Z`);
  y.setUTCDate(y.getUTCDate() - 1);
  return day === y.toISOString().slice(0, 10) ? "yesterday" : "earlier";
}

/** Group a feed into ordered day buckets, dropping empty ones. */
export function groupByDay(
  items: AppNotification[],
  now: string = NOW
): { bucket: DayBucket; items: AppNotification[] }[] {
  const order: DayBucket[] = ["today", "yesterday", "earlier"];
  return order
    .map((bucket) => ({ bucket, items: items.filter((n) => dayBucket(n.createdAt, now) === bucket) }))
    .filter((g) => g.items.length > 0);
}
