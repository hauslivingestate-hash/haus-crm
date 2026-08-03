"use client";

import * as React from "react";
import { AreaChart } from "@/components/ui/AreaChart";
import { C } from "@/components/dashboard/theme";
import {
  HeroProgress,
  RevenueLeaderboard,
  TeamKpiTracker,
  TeamHeatmap,
  Recognition,
  DashCard,
  CardHead,
  fmtTHB,
} from "@/components/dashboard/parts";
import {
  DASH_AGENTS,
  DASH_MONTHS,
  TEAM_GOAL_MONTHLY,
  sumFlow,
  teamGoal,
  revenueSeries,
  monthShort,
} from "@/lib/dashboard";

export function DashboardOverview({
  months,
  prevMonths,
  showPace,
}: {
  months: string[];
  prevMonths: string[];
  showPace: boolean;
}) {
  const team = sumFlow("all", months, ["revenue", "closed_count"]);
  const teamPrev = sumFlow("all", prevMonths, ["revenue", "closed_count"]);

  const trend = revenueSeries("all", DASH_MONTHS).map((p) => ({ label: monthShort(p.month), value: p.revenue }));

  const leaders = DASH_AGENTS.map((a) => ({ agent: a, revenue: sumFlow(a, months, ["revenue"]).revenue })).sort(
    (x, y) => y.revenue - x.revenue
  );
  const top = leaders[0];
  const topUnits = top ? sumFlow(top.agent, months, ["closed_count"]).closed_count : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {top && top.revenue > 0 && (
        <Recognition name={top.agent} note="ยอดปิดการขายสูงสุดของทีมในช่วงนี้ 🎉" value={top.revenue} units={topUnits} />
      )}

      <HeroProgress
        label="รายได้ทีม"
        current={team.revenue}
        previous={teamPrev.revenue}
        units={team.closed_count}
        unitsPrev={teamPrev.closed_count}
        goal={teamGoal(months)}
        showPace={showPace}
      />

      <div className="dash-two-col">
        <DashCard>
          <CardHead eyebrow="แนวโน้ม" title="รายได้ปีนี้" hint={`เส้นเป้าหมายรายเดือน · ${fmtTHB(TEAM_GOAL_MONTHLY)}`} />
          <AreaChart data={trend} goal={TEAM_GOAL_MONTHLY} height={220} format={fmtTHB} color={C.accent} />
        </DashCard>
        <DashCard>
          <CardHead eyebrow="ผู้นำ" title="รายได้ตามเอเจนต์" hint="เรียงตามรายได้ปิดดีลในช่วงที่เลือก" />
          <RevenueLeaderboard rows={leaders} />
        </DashCard>
      </div>

      <TeamKpiTracker />
      <TeamHeatmap />
    </div>
  );
}
