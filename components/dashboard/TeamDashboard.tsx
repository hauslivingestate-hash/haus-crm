import { Suspense } from "react";
import Link from "next/link";
import { RangeBar } from "@/components/dashboard/RangeBar";
import { KpiRow } from "@/components/dashboard/KpiRow";
import { TargetRevenueCard } from "@/components/dashboard/TargetRevenueCard";
import { RevenueTrendCard } from "@/components/dashboard/RevenueTrendCard";
import { TeamAgentsTable } from "@/components/dashboard/TeamAgentsTable";
import { Skeleton, SkeletonStatRow } from "@/components/ui/Skeleton";
import { SegmentedTrack } from "@/components/ui/Segmented";
import { cn } from "@/lib/cn";
import {
  getStandingTeamRevenueTargets,
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
              <Skeleton className="h-64 rounded-lg" />
            </>
          }
        >
          <RevenueBlock team={team} range={range} basis={basis} canSetTargets={canSetTargets} />
        </Suspense>

        <Suspense fallback={<Skeleton className="h-60 rounded-lg" />}>
          <TrendBlock codes={team.memberCodes} basis={basis} />
        </Suspense>
      </div>
    </div>
  );
}

/* Tiles, bar and table in one block: all three read the same summary, and a % tile that
   resolved before the bar and the people under it would be a number with no story. */
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
      <TeamAgentsTable agents={summary.agents} teamActual={summary.actual} rangeLabel={range.label} />
    </>
  );
}

/* Its own block, and it takes no range — same rule as the sales tab's trend. */
async function TrendBlock({ codes, basis }: { codes: string[]; basis: RevenueBasis }) {
  const rows = await getTeamRevenueTrend(codes, basis, 12);
  return <RevenueTrendCard rows={rows} basis={basis} />;
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
