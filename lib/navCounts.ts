import { createClient } from "@/lib/supabase/server";
import type { AuthContext } from "@/lib/auth";
import { navItemFor } from "@/lib/nav";
import { getOverdueFollowUps } from "@/lib/salesDashboard";
import { todayISO } from "@/lib/momentum";
import { getSupportCounts } from "@/lib/support";

/* The numbers on the sidebar.
 *
 * ── A BADGE IS WORK, NOT A TOTAL ────────────────────────────────────────────────
 * "Lead 214" tells nobody anything. "Lead 6" meaning six people you are late to ring is
 * something to act on, and it disappears when you have. Every count here is of that kind,
 * and the sidebar hides the badge at zero — a "0" is a badge that has stopped meaning
 * anything.
 *
 * ── SAME NUMBERS AS THE PAGES THEY POINT AT ─────────────────────────────────────
 * Overdue follow-ups come from the loader the dashboard card uses (it is `cache`d, so on
 * the dashboard the two share one read). Unassigned uses the rule Lead Database uses
 * (`sale_id` blank). Today's tasks use the columns แผนวันนี้ reads. A badge that counted
 * differently from its page would be reported as a bug every week.
 *
 * ── WHAT IS NOT HERE ────────────────────────────────────────────────────────────
 * วันลา's pending-approval count. The leave queue already lives in LeaveProvider on the
 * client and updates the instant a request is decided; the sidebar reads it from there so
 * the badge cannot lag the page. Counting it again here would be a second clock.
 *
 * Computed once per app-layout render, which Next does on every navigation (the layout
 * reads a cookie, so it is dynamic) and on every `router.refresh()` a mutation fires.
 */

/** Keyed by nav href. Absent = nothing to show. */
export type NavCounts = Partial<Record<string, number>>;

export async function getNavCounts(auth: AuthContext): Promise<NavCounts> {
  const me = auth.employeeCode;
  if (!me) return {};

  // Only count for entries this person will see. Gating is the nav's own, defined once.
  const perms = new Set(auth.permissions);
  const shows = (href: string) => {
    const p = navItemFor(href)?.perm;
    return !p || (Array.isArray(p) ? p : [p]).some((k) => perms.has(k));
  };

  const supabase = await createClient();
  const today = todayISO();

  const [tasks, overdue, unassigned, support] = await Promise.all([
    shows("/today")
      ? supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("employee_code", me)
          .eq("task_date", today)
          .not("done", "is", true)
      : null,
    shows("/leads") ? getOverdueFollowUps(me) : null,
    // Lead Database's "unassigned": no salesperson on the row. Blank and NULL both occur
    // in sheet-imported data and the board treats them the same.
    shows("/assign")
      ? supabase
          .from("main_6_buyer_crm")
          .select("lead_id", { count: "exact", head: true })
          .or("sale_id.is.null,sale_id.eq.")
      : null,
    // โต๊ะงาน Support — same rules as the three pages (lib/support.ts).
    shows("/support/new") ? getSupportCounts() : null,
  ]);

  const counts: NavCounts = {};
  if (tasks?.count) counts["/today"] = tasks.count;
  // Leads only — the badge sits on "Lead". The listing side of the same loader belongs to
  // ทรัพย์, and every listing grade has no window yet, so it would read 0 today anyway.
  if (overdue?.totalLeads) counts["/leads"] = overdue.totalLeads;
  if (unassigned?.count) counts["/assign"] = unassigned.count;
  if (support?.new) counts["/support/new"] = support.new;
  if (support?.update) counts["/support/update"] = support.update;
  if (support?.facebook) counts["/support/facebook"] = support.facebook;
  return counts;
}
