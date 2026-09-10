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
  Clock,
  CalendarOff,
  Banknote,
  ImageOff,
  type LucideIcon,
} from "lucide-react";
import { TH_MONTHS } from "@/lib/format";

/** The real clock. This was a constant pinned to the design-phase TODAY, so every row read
 *  "เมื่อสักครู่" for ever. Still injectable so the helpers below stay testable. */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * The `type` enum. Adding one means THREE places, not two:
 * this union, NOTIFICATION_META, and the `notifications_type_check` CHECK constraint in the
 * database — the constraint is what actually rejects an unknown value (found 2026-08-23,
 * when the first cron run failed on it).
 */
export type NotificationType =
  | "lead_assigned"
  | "lead_stage_changed"
  | "deal_won"
  | "task_due"
  | "target_milestone"
  | "listing_new_in_zone"
  | "listing_price_changed"
  // Daily reminders (pg_cron → run_daily_notifications). Each is a once-a-day SUMMARY per
  // person, never one per row: there are ~925 stale leads, and a per-row bell is a dead bell.
  | "lead_stale"
  | "leave_pending"
  | "deal_missing_price"
  | "listing_no_photo";

export type NotificationEntity = "lead" | "listing" | "task" | "target";

export interface AppNotification {
  /** `notifications.id` — a bigint, not a slug. */
  id: number;
  /** Recipient, as `main_1_hr.employee_code` (S-002). The seed keyed this on a login id
   *  matched by display name, which is why the bell was empty for every real session. */
  employeeCode: string;
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
  lead_stale: { label: "ลีดค้าง", icon: Clock, tone: "amber" },
  leave_pending: { label: "ใบลารออนุมัติ", icon: CalendarOff, tone: "violet" },
  // Named for the price because that is the field most often missing, but it fires for any
  // of the three things only the closer knows — ราคาปิด, วันที่ปิด, คอมมิชชั่น (lib/deals.ts).
  deal_missing_price: { label: "ดีลปิดแล้วข้อมูลไม่ครบ", icon: Banknote, tone: "amber" },
  listing_no_photo: { label: "ทรัพย์ยังไม่มีรูป", icon: ImageOff, tone: "blue" },
};

/** Where a notification navigates. Task/target have no detail route — they land on the
 *  surface that owns them. Returns null when there's nothing to open. */
export function notificationHref(n: AppNotification): string | null {
  switch (n.entity) {
    case "lead":
      return n.entityId ? `/leads/${n.entityId}` : "/leads";
    case "listing":
      // A summary carries no entityId — send it to the list it is about.
      return n.entityId ? `/listings/${n.entityId}` : "/listings";
    case "task":
      // ใบลารออนุมัติ lands on the leave queue, not the daily plan.
      return n.type === "leave_pending" ? "/leave" : "/today";
    case "target":
      // `deal_missing_price` was raised against `target` until 2026-09-06, when it stopped
      // being about main_7_last_match (a market log of other agencies' sales) and became a
      // check on the deal's own row. New rows carry entity `lead`; this keeps any already
      // in the table landing somewhere that can actually be acted on.
      return n.type === "deal_missing_price" ? "/leads" : "/today";
    default:
      return null;
  }
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
export function relativeTimeTh(iso: string, now: string = nowISO()): string {
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
export function dayBucket(iso: string, now: string = nowISO()): DayBucket {
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
  now: string = nowISO()
): { bucket: DayBucket; items: AppNotification[] }[] {
  const order: DayBucket[] = ["today", "yesterday", "earlier"];
  return order
    .map((bucket) => ({ bucket, items: items.filter((n) => dayBucket(n.createdAt, now) === bucket) }))
    .filter((g) => g.items.length > 0);
}
