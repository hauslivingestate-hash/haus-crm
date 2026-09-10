"use server";

/* Saving a person's column layout.

   NO PERMISSION GATE, deliberately. Which columns YOU see on a grid you are
   already allowed to open is not an authorisation question — `leads.view` and
   `listings.view` gate the pages themselves. This records a reading
   preference, scoped to the session's own employee code, which is read from
   the server session and never from the request body.

   NO revalidatePath either. The manager is optimistic — a tick has to move the
   column immediately — so the client holds the truth for the rest of the
   session and this call is fire-and-forget. Re-rendering /leads (which pulls
   every lead) because someone hid a column would be a full page round trip for
   a checkbox. */

import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import { isTableKey, sanitize, type TablePrefs } from "./index";

/** Replace one grid's layout for the signed-in person.

    `knownKeys` and `lockedKey` come from the client's own registry, which
    sounds like trusting the caller and is not: they are only ever used to
    NARROW what gets stored (see `sanitize`), so the worst a forged pair can do
    is save a preference that `resolve` discards on read. The registry in code
    stays the authority on both ends. */
export async function saveTablePrefs(
  tableKey: string,
  prefs: TablePrefs,
  knownKeys: string[],
  lockedKey?: string,
): Promise<void> {
  const auth = await getAuthContext();
  if (!auth?.employeeCode) throw new Error("UNAUTHENTICATED");
  if (!isTableKey(tableKey)) throw new Error("ตารางไม่ถูกต้อง");

  const clean = sanitize(knownKeys, lockedKey, prefs);
  const supabase = await createClient();

  const { error } = await supabase.from("table_prefs").upsert(
    {
      employee_code: auth.employeeCode,
      table_key: tableKey,
      column_order: clean.order,
      hidden: clean.hidden,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "employee_code,table_key" },
  );
  if (error) throw new Error(error.message);
}

/** Forget a grid's layout — the "คืนค่าเริ่มต้น" button. Deletes the row
    rather than storing an empty one, so "never set" and "reset to default"
    are the same state and neither needs its own branch on read. */
export async function resetTablePrefs(tableKey: string): Promise<void> {
  const auth = await getAuthContext();
  if (!auth?.employeeCode) throw new Error("UNAUTHENTICATED");
  if (!isTableKey(tableKey)) throw new Error("ตารางไม่ถูกต้อง");

  const supabase = await createClient();
  const { error } = await supabase
    .from("table_prefs")
    .delete()
    .eq("employee_code", auth.employeeCode)
    .eq("table_key", tableKey);
  if (error) throw new Error(error.message);
}
