import { Sidebar } from "@/components/Sidebar";
import { AppFrame, ShellProvider, SIDEBAR_COOKIE } from "@/components/Shell";
import { RbacProvider } from "@/components/RbacProvider";
import { MasterDataProvider } from "@/components/MasterDataProvider";
import { ChecklistProvider } from "@/components/ChecklistProvider";
import { CopyTemplatesProvider } from "@/components/CopyTemplatesProvider";
import { ProbationProvider } from "@/components/ProbationProvider";
import { NotificationsProvider } from "@/components/NotificationsProvider";
import { ActivityProvider } from "@/components/ActivityProvider";
import { LeaveProvider } from "@/components/LeaveProvider";
import { LeadIntakeFab } from "@/components/LeadIntakeFab";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getAuthContext } from "@/lib/auth";
import { getLookups, getAssignableAgents } from "@/lib/lookups";
import { getNavCounts } from "@/lib/navCounts";
import {
  getLeaveRequests,
  getLeaveAllowances,
  getSalesRanks,
  getNotifications,
  getActivityFeed,
  getCopyTemplateOverrides,
  getChecklistTemplates,
} from "@/lib/queries";
import { AUTH_ENFORCED } from "@/lib/supabaseConfig";

// The SIGNED-IN application shell. Everything inside this route group gets the sidebar, the
// FAB and the in-memory stores; `/login` sits outside it and gets none of them.
//
// This is the auth boundary. The middleware redirects first, but this check is what makes it
// true for direct/server renders — and it is where the session's real permissions enter the
// React tree, replacing the seeded "view as" identity.
//
// While AUTH_ENFORCED is off (no accounts exist yet) `session` is null and RbacProvider
// falls back to the seeded org, exactly as in the design phase.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const auth = AUTH_ENFORCED ? await getAuthContext() : null;
  if (AUTH_ENFORCED && !auth) redirect("/login");

  // Sidebar collapse preference — read here so the first paint is already the right
  // width. See components/Shell.tsx for why it is a cookie.
  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "1";

  // Reference vocabularies + assignable agents come from the DB so the intake form writes
  // FK-valid values. Without a session RLS returns nothing, so the providers keep their
  // seeds — which is right for design mode, where nothing is written anyway.
  // Leave is loaded here rather than on /leave alone: แผนวันนี้ shows an "on leave today"
  // banner from the same list, so both surfaces must see one queue.
  const [
    lookups,
    agents,
    leaveRequests,
    leaveAllowances,
    salesRanks,
    notifications,
    activities,
    copyOverrides,
    checklistTemplates,
    navCounts,
  ] = auth
    ? await Promise.all([
        getLookups(),
        getAssignableAgents(),
        getLeaveRequests(),
        getLeaveAllowances(),
        getSalesRanks(),
        getNotifications(),
        getActivityFeed(),
        getCopyTemplateOverrides(),
        getChecklistTemplates(),
        getNavCounts(auth),
      ])
    : [undefined, [], [], undefined, undefined, [], [], {}, [], {}];

  return (
    <RbacProvider
      session={
        auth
          ? {
              employeeCode: auth.employeeCode,
              name: auth.nickname ?? auth.email ?? "ผู้ใช้",
              permissions: auth.permissions,
            }
          : null
      }
    >
      {/* Inside RbacProvider — feeds/leads are scoped to the current viewer. */}
      <MasterDataProvider initial={lookups}>
        <ChecklistProvider templates={checklistTemplates}>
          <CopyTemplatesProvider overrides={copyOverrides}>
            <ProbationProvider initial={salesRanks}>
              <NotificationsProvider items={notifications}>
                {/* Live activity log. Fed by Daily-Plan task completion — the +บันทึก FAB
                    was removed per CEO feedback R1, so this is the only write path. */}
                <ActivityProvider activities={activities}>
                  {/* Leave requests — filed from แผนวันนี้, decided on /วันลา. Shared so
                      both sides see the same queue instantly. */}
                  <LeaveProvider requests={leaveRequests} allowances={leaveAllowances}>
                    <ShellProvider initialCollapsed={collapsed}>
                      <AppFrame sidebar={<Sidebar counts={navCounts} />}>{children}</AppFrame>
                      {/* Lead intake FAB — gated to leads.create (admin/back-office). The
                          only remaining FAB (CEO: "FAB เหลือแค่เพิ่มลีด"). */}
                      <LeadIntakeFab agents={agents} />
                    </ShellProvider>
                  </LeaveProvider>
                </ActivityProvider>
              </NotificationsProvider>
            </ProbationProvider>
          </CopyTemplatesProvider>
        </ChecklistProvider>
      </MasterDataProvider>
    </RbacProvider>
  );
}
