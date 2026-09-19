import { createClient } from "@/lib/supabase/server";
import type { AuthContext } from "@/lib/auth";
import { NAV } from "@/lib/nav";

/* Which sidebar sections a person has folded (Ben, 2026-09-19: "แก้เฉพาะหน้าของเรา").
 *
 * Stored in `table_prefs` — the per-person preference table the column manager already uses —
 * under table_key "sidebar", with the folded section titles in `hidden`. No new table: it is
 * the same kind of fact (one person's reading preference), under the same own-row RLS.
 *
 * Everyone starts with every section open, so nobody's sidebar changes until they fold
 * something themselves. A failure to read returns "nothing folded" rather than breaking the
 * layout. */

export const SIDEBAR_PREF_KEY = "sidebar";

/** Section titles that can be folded — the titled groups. The untitled bottom group
    (ตั้งค่า) is not a section. */
export const FOLDABLE_SECTIONS = NAV.filter((g) => g.title).map((g) => g.title);

export async function getFoldedSections(auth: AuthContext): Promise<string[]> {
  if (!auth.employeeCode) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("table_prefs")
    .select("hidden")
    .eq("employee_code", auth.employeeCode)
    .eq("table_key", SIDEBAR_PREF_KEY)
    .maybeSingle();
  if (error || !data || !Array.isArray(data.hidden)) return [];
  // A title this release no longer has is dropped, not kept forever.
  return (data.hidden as string[]).filter((t) => FOLDABLE_SECTIONS.includes(t));
}
