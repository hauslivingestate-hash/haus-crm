import { LayoutDashboard } from "lucide-react";
import { Topbar } from "@/components/Topbar";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";
import { SalesDashboard } from "@/components/dashboard/SalesDashboard";
import { TeamDashboard } from "@/components/dashboard/TeamDashboard";
import { getVisibleTeams } from "@/lib/teamDashboard";
import { getAuthContext } from "@/lib/auth";
import { resolveTab, visibleTabs } from "@/lib/dashboardTabs";

/* The dashboard is TABBED — one layout per kind of job, and a viewer gets the tabs
 * their permissions admit (lib/dashboardTabs.ts). Ben, 2026-09-10: "we need to have
 * multiple dashboard layout that suits each role as well".
 *
 * Only ขาย is built. With one tab the strip hides itself, so a sale sees their
 * dashboard with no chrome; the strip appears the moment a second tab ships.
 *
 * ── LIVE DATA, NEVER CACHED ─────────────────────────────────────────────────────
 * Every number here is scoped to the signed-in employee and filtered by a range read
 * from the URL. A cached render would serve one person's scoreboard to the next.
 */
export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; range?: string; from?: string; to?: string; basis?: string; team?: string }>;
}) {
  const [params, auth] = await Promise.all([searchParams, getAuthContext()]);

  const tabs = auth ? visibleTabs(auth.permissions) : [];
  const tab = resolveTab(params.tab, tabs);

  // An account with no employee row can't be scored — there is no employee_code to
  // filter by, and inventing one would show someone else's numbers.
  if (!auth?.employeeCode) return <Empty reason="account" />;
  if (!tab) return <Empty reason="permission" />;

  const canSetTargets =
    auth.permissions.includes("targets.set") || auth.permissions.includes("roles.manage");

  return (
    <>
      <Topbar
        title="แดชบอร์ด"
        subtitle={tab.id === "team" ? "ภาพรวมของทีม" : `ภาพรวมของ ${auth.nickname ?? auth.employeeCode}`}
        actions={false}
      />
      <DashboardTabs tabs={tabs} active={tab.id} />
      <div className="flex-1">
        {tab.id === "sales" && (
          <SalesDashboard employeeCode={auth.employeeCode} canSetTargets={canSetTargets} searchParams={params} />
        )}
        {tab.id === "team" && <TeamTab canSetTargets={canSetTargets} searchParams={params} />}
      </div>
    </>
  );
}

/* Which team: `?team=` if it names one the viewer may open, else their first. A stale
   `?team=` (a deleted team, a link from someone with a different scope) falls back
   rather than erroring, for the same reason a stale `?tab=` does. */
async function TeamTab({
  canSetTargets,
  searchParams,
}: {
  canSetTargets: boolean;
  searchParams: { range?: string; from?: string; to?: string; basis?: string; team?: string };
}) {
  const teams = await getVisibleTeams();
  const team = teams.find((t) => t.id === searchParams.team) ?? teams[0];
  if (!team) {
    return (
      <div className="grid place-items-center p-6">
        <div className="flex max-w-sm flex-col items-center gap-3 py-10 text-center">
          <div className="grid size-14 place-items-center rounded-2xl border border-border bg-surface-2">
            <LayoutDashboard size={26} strokeWidth={1.75} className="text-text-subtle" />
          </div>
          <p className="text-body text-text-subtle">
            ยังไม่มีทีมให้ดู — สร้างทีมและใส่สมาชิกได้ที่ ตั้งค่า ▸ ทีม
          </p>
        </div>
      </div>
    );
  }
  return <TeamDashboard teams={teams} team={team} canSetTargets={canSetTargets} searchParams={searchParams} />;
}

/* Two different nothings, and they must not read alike: one is a setup job for an
   admin, the other is a boundary working as designed. */
function Empty({ reason }: { reason: "account" | "permission" }) {
  return (
    <>
      <Topbar title="แดชบอร์ด" actions={false} />
      <div className="flex-1 grid place-items-center p-6">
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <div className="grid size-14 place-items-center rounded-2xl border border-border bg-surface-2">
            <LayoutDashboard size={26} strokeWidth={1.75} className="text-text-subtle" />
          </div>
          <p className="text-body text-text-subtle">
            {reason === "account"
              ? "บัญชีนี้ยังไม่ได้ผูกกับข้อมูลพนักงาน จึงยังไม่มีตัวเลขให้แสดง — ติดต่อผู้ดูแลระบบ"
              : "บัญชีของคุณยังไม่มีสิทธิ์ดูแดชบอร์ดใด — ดูข้อมูลได้จากหน้าอื่นในเมนู"}
          </p>
        </div>
      </div>
    </>
  );
}
