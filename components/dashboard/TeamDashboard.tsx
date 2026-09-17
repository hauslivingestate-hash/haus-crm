import { Suspense } from "react";
import Link from "next/link";
import { RangeBar } from "@/components/dashboard/RangeBar";
import { KpiRow } from "@/components/dashboard/KpiRow";
import { TargetRevenueCard } from "@/components/dashboard/TargetRevenueCard";
import { RevenueTrendCard } from "@/components/dashboard/RevenueTrendCard";
import { TeamLeaderboard } from "@/components/dashboard/TeamLeaderboard";
import { TeamKpiTracker } from "@/components/dashboard/TeamKpiTracker";
import { ActivityHeatmap } from "@/components/dashboard/ActivityHeatmap";
import { Skeleton, SkeletonStatRow } from "@/components/ui/Skeleton";
import { SegmentedTrack } from "@/components/ui/Segmented";
import { cn } from "@/lib/cn";
import {
  getStandingTeamRevenueTargets,
  getTeamActivityHeatmap,
  getTeamKpiProgress,
  getTeamRevenueSummary,
  getTeamRevenueTrend,
  type TeamOption,
} from "@/lib/teamDashboard";
import { resolveRange, type Range } from "@/lib/range";
import { asRevenueBasis, type RevenueBasis } from "@/lib/deals";

/* แดชบอร์ดทีม — one team's revenue, for whoever leads it.
 *
 * ── THE SAME PARTS AS ขาย, ON PURPOSE ───────────────────────────────────────────
 * The tiles, the target bar and the trend are the exact components the sales tab
 * renders, fed a team-shaped summary. A leader switching tabs should find the same
 * shapes meaning the same things, with only the scope changed. The one new part is the
 * per-person table, which has no counterpart on a personal scoreboard.
 *
 * ── FULL WIDTH, NO PLANNER (Ben, 2026-09-16) ────────────────────────────────────
 * The sales tab keeps the day's work in a right column because that tab is the page a
 * salesperson works from. A leader reads this one; there is nothing to tick here.
 *
 * ── `?team=` ────────────────────────────────────────────────────────────────────
 * With one team the switcher stays hidden and the param is never written. It exists for
 * the day the CEO names a second team, and it lives in the URL for the same reason the
 * tab and the range do: the page is a server component and must know before rendering.
 */
export function TeamDashboard({
  teams,
  team,
  canSetTargets,
  searchParams,
}: {
  teams: TeamOption[];
  team: TeamOption;
  /** `targets.set` — shows the inline ตั้งเป้า editor on the team target. */
  canSetTargets: boolean;
  searchParams: { range?: string; from?: string; to?: string; basis?: string; team?: string };
}) {
  const range = resolveRange(searchParams);
  const basis = asRevenueBasis(searchParams.basis);

  return (
    <div className="flex flex-col">
      <div className="sticky top-14 z-20 border-b border-border bg-background/85 px-4 py-2.5 backdrop-blur lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <RangeBar active={range.key} from={searchParams.from} to={searchParams.to} />
          {teams.length > 1 && <TeamSwitcher teams={teams} active={team.id} searchParams={searchParams} />}
        </div>
      </div>

      <div className="flex flex-col gap-4 p-4 lg:p-6">
        <Suspense
          fallback={
            <>
              <SkeletonStatRow />
              <Skeleton className="h-36 rounded-lg" />
            </>
          }
        >
          <RevenueBlock team={team} range={range} basis={basis} canSetTargets={canSetTargets} />
        </Suspense>

        {/* The HAUS V2 overview's second row: the trend takes 1.4fr, the leaderboard 1fr
            (`.dash-two-col`, app/globals.css — a class rather than Tailwind because the
            ratio is a media query and these are two independent Suspense children).
            Each streams on its own, so the slower of the two never holds the other up. */}
        <div className="dash-two-col">
          <Suspense fallback={<Skeleton className="h-72 rounded-lg" />}>
            <TrendBlock teamId={team.id} codes={team.memberCodes} basis={basis} />
          </Suspense>
          <Suspense fallback={<Skeleton className="h-72 rounded-lg" />}>
            <LeaderboardBlock team={team} range={range} basis={basis} />
          </Suspense>
        </div>

        {/* HAUS V2's third row, between the trend and the heatmap: process before
            behaviour. Revenue says what landed, KPI says whether the work that produces
            it is being done, the heatmap says on which days. */}
        <Suspense fallback={<Skeleton className="h-64 rounded-lg" />}>
          <KpiBlock team={team} range={range} />
        </Suspense>

        <Suspense fallback={<Skeleton className="h-72 rounded-lg" />}>
          <HeatmapBlock team={team} range={range} />
        </Suspense>
      </div>
    </div>
  );
}

/* Tiles and bar in one block: both read the same summary, and a % tile that resolved
   before the bar under it would be a number with no story. The per-person breakdown used
   to be here too; it now sits beside the trend, and shares this summary through the
   `cache()` on getTeamRevenueSummary rather than running the RPCs a second time. */
async function RevenueBlock({
  team,
  range,
  basis,
  canSetTargets,
}: {
  team: TeamOption;
  range: Range;
  basis: RevenueBasis;
  canSetTargets: boolean;
}) {
  const [summary, standing] = await Promise.all([
    getTeamRevenueSummary(team, range, basis),
    canSetTargets ? getStandingTeamRevenueTargets(team.id) : Promise.resolve({}),
  ]);
  return (
    <>
      <KpiRow summary={summary} newLeads={summary.newLeads} range={range} />
      <TargetRevenueCard
        summary={summary}
        range={range}
        standing={standing}
        scope={{ kind: "team", teamId: team.id }}
        canEdit={canSetTargets}
      />
    </>
  );
}

/* The leaderboard's own block so it can sit in the grid beside the trend and stream
   separately. The summary it reads is the one RevenueBlock already fetched — `cache()`
   makes the second call free. */
async function LeaderboardBlock({
  team,
  range,
  basis,
}: {
  team: TeamOption;
  range: Range;
  basis: RevenueBasis;
}) {
  const summary = await getTeamRevenueSummary(team, range, basis);
  return <TeamLeaderboard agents={summary.agents} rangeLabel={range.label} basis={basis} />;
}

/* Its own block, and it takes no range — same rule as the sales tab's trend.
   The STANDING monthly target comes along for the threshold line: the trend is twelve
   months, so the figure that belongs on it is the monthly one, never whatever the range
   bar happens to have resolved. */
async function TrendBlock({
  teamId,
  codes,
  basis,
}: {
  teamId: string;
  codes: string[];
  basis: RevenueBasis;
}) {
  const [rows, standing] = await Promise.all([
    getTeamRevenueTrend(codes, basis, 12),
    getStandingTeamRevenueTargets(teamId),
  ]);
  return <RevenueTrendCard rows={rows} basis={basis} monthlyTarget={standing.month ?? 0} />;
}

async function KpiBlock({ team, range }: { team: TeamOption; range: Range }) {
  const kpis = await getTeamKpiProgress(team, range);
  return <TeamKpiTracker kpis={kpis} rangeLabel={range.label} />;
}

/* Its own block, and the only card here that does not honour the range bar — it renders
   the calendar month containing `range.end` (see getTeamActivityHeatmap). Last on the
   page because it is the slowest read and the least urgent: a leader checks revenue
   first and only then asks who was working. */
async function HeatmapBlock({ team, range }: { team: TeamOption; range: Range }) {
  const data = await getTeamActivityHeatmap(team, range);
  return <ActivityHeatmap data={data} />;
}

/** Plain links, not buttons: the choice is a URL and a server render, and a link is
    what that is. Styled as the same pill track the range presets use so it reads as a
    filter, which is what it is. */
function TeamSwitcher({
  teams,
  active,
  searchParams,
}: {
  teams: TeamOption[];
  active: string;
  searchParams: Record<string, string | undefined>;
}) {
  const hrefFor = (id: string) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) if (v) next.set(k, v);
    next.set("tab", "team");
    next.set("team", id);
    return `/?${next.toString()}`;
  };
  return (
    <SegmentedTrack aria-label="ทีม">
      {teams.map((t) => {
        const on = t.id === active;
        return (
          <Link
            key={t.id}
            href={hrefFor(t.id)}
            aria-current={on ? "true" : undefined}
            className={cn(
              "inline-flex h-7 items-center whitespace-nowrap rounded-full px-3 text-small transition-colors",
              on ? "bg-navy font-medium text-surface shadow-card" : "text-text-muted hover:text-text"
            )}
          >
            {t.name}
          </Link>
        );
      })}
    </SegmentedTrack>
  );
}
