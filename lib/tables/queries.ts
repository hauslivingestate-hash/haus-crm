import "server-only";

/* Reading a person's saved column layouts.

   Keyed by `employee_code`, like every other per-person row in this schema
   (`tasks`, `targets`, `activities`, `notifications`) and like the
   `current_employee_code()` chain every RLS policy filters on. An account with
   no employee row simply has no preferences: the grid falls back to the
   registry's own order, which is the correct default anyway. */

import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import { isTableKey, type TablePrefs, type TablePrefsMap } from "./index";

/** Every grid's layout for the signed-in person, in one round trip.

   One query for all tables rather than one per grid: a page renders a single
   browser today, but the cost is identical and this keeps the read out of the
   per-table code entirely.

   A failure returns {} rather than throwing. A layout that could not be read
   is not worth failing a page over — the grid renders in registry order,
   which is what someone who has never opened the manager sees regardless. */
export async function getTablePrefs(): Promise<TablePrefsMap> {
  const auth = await getAuthContext();
  if (!auth?.employeeCode) return {};

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("table_prefs")
    .select("table_key, column_order, hidden")
    .eq("employee_code", auth.employeeCode);

  if (error || !data) return {};

  const out: TablePrefsMap = {};
  for (const row of data) {
    const key = row.table_key as string;
    // A row for a grid this release no longer has is ignored rather than
    // surfaced — same rule `resolve` applies to individual column keys.
    if (!isTableKey(key)) continue;
    out[key] = {
      order: Array.isArray(row.column_order) ? (row.column_order as string[]) : [],
      hidden: Array.isArray(row.hidden) ? (row.hidden as string[]) : [],
    } satisfies TablePrefs;
  }
  return out;
}
