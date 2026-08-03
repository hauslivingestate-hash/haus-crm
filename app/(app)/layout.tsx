import { Sidebar } from "@/components/Sidebar";
import { MobileNavProvider } from "@/components/MobileNav";
import { RbacProvider } from "@/components/RbacProvider";
import { MasterDataProvider } from "@/components/MasterDataProvider";
import { ChecklistProvider } from "@/components/ChecklistProvider";
import { CopyTemplatesProvider } from "@/components/CopyTemplatesProvider";
import { ProbationProvider } from "@/components/ProbationProvider";
import { NotificationsProvider } from "@/components/NotificationsProvider";
import { NewLeadsProvider } from "@/components/NewLeadsProvider";
import { ActivityProvider } from "@/components/ActivityProvider";
import { LeaveProvider } from "@/components/LeaveProvider";
import { LeadIntakeFab } from "@/components/LeadIntakeFab";

// The SIGNED-IN application shell. Everything inside this route group gets the sidebar, the
// FAB and the in-memory stores; `/login` sits outside it and gets none of them.
//
// Wire: this is the natural auth boundary — check the session here and redirect to /login
// when absent, so no app state is ever built for a signed-out visitor. RbacProvider's
// "view as" switcher is then replaced by the real session identity.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RbacProvider>
      {/* Inside RbacProvider — feeds/leads are scoped to the current viewer. */}
      <MasterDataProvider>
        <ChecklistProvider>
          <CopyTemplatesProvider>
            <ProbationProvider>
              <NotificationsProvider>
                <NewLeadsProvider>
                  {/* Live activity log. Fed by Daily-Plan task completion — the +บันทึก FAB
                      was removed per CEO feedback R1, so this is the only write path. */}
                  <ActivityProvider>
                    {/* Leave requests — filed from แผนวันนี้, decided on /วันลา. Shared so
                        both sides see the same queue instantly. */}
                    <LeaveProvider>
                    <MobileNavProvider>
                      <div className="grid grid-cols-1 lg:grid-cols-[228px_1fr] min-h-screen">
                        <Sidebar />
                        <main className="min-w-0 flex flex-col">{children}</main>
                      </div>
                      {/* Lead intake FAB — gated to leads.create (admin/back-office). The
                          only remaining FAB (CEO: "FAB เหลือแค่เพิ่มลีด"). */}
                      <LeadIntakeFab />
                    </MobileNavProvider>
                    </LeaveProvider>
                  </ActivityProvider>
                </NewLeadsProvider>
              </NotificationsProvider>
            </ProbationProvider>
          </CopyTemplatesProvider>
        </ChecklistProvider>
      </MasterDataProvider>
    </RbacProvider>
  );
}
