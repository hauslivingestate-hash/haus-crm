"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import type { NotificationEntity, NotificationType } from "@/lib/notifications";

// การแจ้งเตือน — `notifications`, which was created 2026-08-03 and has stayed empty while
// the bell showed a seeded feed. Nothing ever wrote to it, so nobody was ever told anything.
//
// RLS is own-row (`employee_code = current_employee_code()` OR roles.manage) on all four
// verbs. That is right for reading and for marking read, but it means a rep CANNOT notify a
// colleague through the app client — the INSERT policy refuses a row addressed to someone
// else. `notify()` is therefore only usable for the cases where the recipient is the actor,
// or where the caller holds roles.manage.
//
// ⚠️ Which is why lead assignment does NOT notify from here: the whole point is to tell
// SOMEONE ELSE they have a new lead, and the assigner is rarely an admin. Doing that
// properly needs either a `security definer` RPC or a trigger, and inventing one silently
// would be a bigger decision than this file. Noted rather than half-built.

type Result = { ok: true } | { ok: false; error: string };

export interface NotifyInput {
  employeeCode: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  entity?: NotificationEntity | null;
  entityId?: string | null;
}

/** Raise a notification. Only for yourself unless you hold roles.manage — see the note above. */
export async function notify(input: NotifyInput): Promise<Result> {
  const auth = await getAuthContext();
  if (!auth?.employeeCode) return { ok: false, error: "ไม่พบสิทธิ์ผู้ใช้" };
  if (!input.title.trim()) return { ok: false, error: "ต้องมีหัวข้อ" };

  const supabase = await createClient();
  const { error } = await supabase.from("notifications").insert({
    employee_code: input.employeeCode,
    type: input.type,
    title: input.title.trim(),
    body: input.body?.trim() || null,
    entity: input.entity ?? null,
    entity_id: input.entityId ?? null,
    actor: auth.nickname ?? auth.employeeCode,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function markNotificationRead(id: number): Promise<Result> {
  const auth = await getAuthContext();
  if (!auth?.employeeCode) return { ok: false, error: "ไม่พบสิทธิ์ผู้ใช้" };

  const supabase = await createClient();
  // `is("read_at", null)` keeps the original timestamp when something is marked twice —
  // the bell fires this on render in a couple of places.
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function markAllNotificationsRead(): Promise<Result> {
  const auth = await getAuthContext();
  if (!auth?.employeeCode) return { ok: false, error: "ไม่พบสิทธิ์ผู้ใช้" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    // Scoped in the query as well as by RLS: `roles.manage` widens the policy to every row,
    // so an admin pressing "mark all read" would otherwise clear the whole company's bell.
    .eq("employee_code", auth.employeeCode)
    .is("read_at", null);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}
