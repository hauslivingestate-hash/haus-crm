"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import { FOLDABLE_SECTIONS, SIDEBAR_PREF_KEY } from "@/lib/navPrefs";

/* Save which sidebar sections the signed-in person has folded.

   No permission gate and no revalidatePath, for the same reasons as saveTablePrefs: it is a
   reading preference scoped to the session's own employee code (never taken from the
   request), and the sidebar folds optimistically — re-rendering the layout for a click on a
   section header would be a round trip for nothing. */
export async function saveFoldedSections(folded: string[]): Promise<void> {
  const auth = await getAuthContext();
  if (!auth?.employeeCode) throw new Error("UNAUTHENTICATED");

  // Only titles that exist — the caller cannot store arbitrary strings here.
  const clean = [...new Set(folded)].filter((t) => FOLDABLE_SECTIONS.includes(t));
  const supabase = await createClient();

  if (clean.length === 0) {
    // "Nothing folded" is the default; store it as no row, like "คืนค่าเริ่มต้น" does.
    const { error } = await supabase
      .from("table_prefs")
      .delete()
      .eq("employee_code", auth.employeeCode)
      .eq("table_key", SIDEBAR_PREF_KEY);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase.from("table_prefs").upsert(
    {
      employee_code: auth.employeeCode,
      table_key: SIDEBAR_PREF_KEY,
      column_order: [],
      hidden: clean,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "employee_code,table_key" }
  );
  if (error) throw new Error(error.message);
}
