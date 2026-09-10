import { Suspense } from "react";
import { RangeBar } from "@/components/dashboard/RangeBar";
import { UnpricedCloses } from "@/components/dashboard/UnpricedCloses";
import { MovementCard } from "@/components/dashboard/MovementCard";
import { TargetRevenueCard } from "@/components/dashboard/TargetRevenueCard";
import { RevenueTrendCard } from "@/components/dashboard/RevenueTrendCard";
import { FollowUpCard } from "@/components/dashboard/FollowUpCard";
import { TodayCard } from "@/components/dashboard/TodayCard";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  getActivityTotals,
  getLeadFunnel,
  getOverdueFollowUps,
  getRevenueSummary,
  getRevenueTrend,
  getStageMovement,
  getStandingRevenueTargets,
  getTodaySummary,
  getUnpricedCloses,
} from "@/lib/salesDashboard";
import { resolveRange, type Range } from "@/lib/range";
import { asRevenueBasis, type RevenueBasis } from "@/lib/deals";

/* แดชบอร์ดขาย — the scoreboard for whoever is signed in.
 *
 * ── THE LAYOUT IS KLAICHAN'S; THE SKIN IS OURS ──────────────────────────────────
 * Ben, 2026-09-10: same components, same layout, same level of detail — HAUS's styling.
 * So the shape below matches Klaichan CRM's dashboard exactly:
 *
 *   the banner        outstanding work, ABOVE the filter, because a deal missing its
 *                     commission is missing it in every period
 *   the filter row    sticky, above everything it scopes — never a filter inside a card
 *   left column 2/3   the business: money on top, then the trend, then the pipeline
 *   right column 1/3  the day: what is on today and what has gone overdue
 *
 * The two-column split is the part that matters: the business figures are read in a
 * sitting, the day is glanced at. Stacking them, which is what this file did first, gave
 * the day's work equal weight to the quarter's revenue and pushed the pipeline below the
 * fold.
 *
 * ── EVERY NUMBER IS THIS PERSON'S OWN ───────────────────────────────────────────
 * Not the team's, even for a CEO — see lib/salesDashboard.ts. The team view is its own
 * tab.
 */
export function SalesDashboard({
  employeeCode,
  canSetTargets,
  searchParams,
}: {
  employeeCode: string;
  /** `targets.set` — shows the inline ตั้งเป้า editor. A sale never holds this. */
  canSetTargets: boolean;
  searchParams: { range?: string; from?: string; to?: string; basis?: string };
}) {
  const range = resolveRange(searchParams);
  // Close by default: the sales scoreboard is what was SOLD. Win is one tap away.
  const basis = asRevenueBasis(searchParams.basis);

  return (
    <div className="flex flex-col">
      <Suspense fallback={null}>
        <UnpricedBlock employeeCode={employeeCode} />
      </Suspense>

      {/* Sticky, so the period a number belongs to is never off-screen while reading it.
          top-14 clears the Topbar; the tab strip scrolls away beneath it. */}
      <div className="sticky top-14 z-20 border-b border-border bg-background/85 px-4 py-2.5 backdrop-blur lg:px-6">
        <RangeBar active={range.key} from={searchParams.from} to={searchParams.to} />
      </div>

      <div className="grid grid-cols-1 gap-4 p-4 xl:grid-cols-3 lg:p-6">
        {/* ---- left 2/3: the business ---- */}
        <div className="flex flex-col gap-4 xl:col-span-2">
          {/* เป้ารายได้ takes the full column width. Klaichan pairs it with a เป้าหมาย
              card here; Ben removed that on 2026-09-10, so nothing shares the row and a
              half-width card beside an empty column would just read as a failed load. */}
          <Suspense fallback={<Skeleton className="h-52 rounded-lg" />}>
            <RevenueBlock
              employeeCode={employeeCode}
              range={range}
              basis={basis}
              canSetTargets={canSetTargets}
            />
          </Suspense>

          <Suspense fallback={<Skeleton className="h-60 rounded-lg" />}>
            <TrendBlock employeeCode={employeeCode} basis={basis} />
          </Suspense>

          <Suspense fallback={<Skeleton className="h-80 rounded-lg" />}>
            <MovementBlock employeeCode={employeeCode} range={range} />
          </Suspense>
        </div>

        {/* ---- right 1/3: the day ----
            Deliberately NOT scoped by the range bar: what is on today and what has gone
            overdue are true regardless of which period is being inspected, and letting
            "ปีนี้" imply a year's worth of overdue follow-ups would be a lie. */}
        <div className="flex flex-col gap-4">
          <Suspense fallback={<Skeleton className="h-20 rounded-lg" />}>
            <TodayBlock employeeCode={employeeCode} />
          </Suspense>
          <Suspense fallback={<Skeleton className="h-72 rounded-lg" />}>
            <FollowUpBlock employeeCode={employeeCode} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

/* Nothing outstanding is the NORMAL state and must leave no trace — no wrapper, no
   margin, no empty card. A gap above the filter with nothing in it reads as something
   that failed to load. */
async function UnpricedBlock({ employeeCode }: { employeeCode: string }) {
  const rows = await getUnpricedCloses(employeeCode);
  if (rows.length === 0) return null;
  return (
    <div className="px-4 pt-4 lg:px-6">
      <UnpricedCloses rows={rows} />
    </div>
  );
}

async function RevenueBlock({
  employeeCode,
  range,
  basis,
  canSetTargets,
}: {
  employeeCode: string;
  range: Range;
  basis: RevenueBasis;
  canSetTargets: boolean;
}) {
  const [summary, standing] = await Promise.all([
    getRevenueSummary(employeeCode, range, basis),
    // Loaded with the card rather than on demand: the editor is one tap away and a
    // spinner inside a form that just opened reads as a broken form.
    canSetTargets ? getStandingRevenueTargets(employeeCode) : Promise.resolve({}),
  ]);
  return (
    <TargetRevenueCard
      summary={summary}
      range={range}
      standing={standing}
      employeeCode={employeeCode}
      canEdit={canSetTargets}
    />
  );
}

/* Its own block, and it takes no range: the trend is the one card the filter does not
   touch, so it must not re-render when the filter changes. */
async function TrendBlock({ employeeCode, basis }: { employeeCode: string; basis: RevenueBasis }) {
  const rows = await getRevenueTrend(employeeCode, basis, 12);
  return <RevenueTrendCard rows={rows} basis={basis} />;
}

/* ONE card for both halves and both views, as in Klaichan — not a pipeline card beside
   an activity card. They are the same question ("what moved in this window") asked of the
   two sides of the business, and splitting them into separate cards let a reader compare
   actions against stage moves as though they were the same unit. They are not. */
async function MovementBlock({ employeeCode, range }: { employeeCode: string; range: Range }) {
  const [activity, funnel, stages] = await Promise.all([
    getActivityTotals(employeeCode, range),
    getLeadFunnel(employeeCode, range),
    getStageMovement(employeeCode, range),
  ]);
  return (
    <MovementCard
      activity={activity}
      funnel={funnel}
      stages={stages}
      rangeLabel={range.label}
      compareLabel={range.compareLabel}
    />
  );
}

async function TodayBlock({ employeeCode }: { employeeCode: string }) {
  const summary = await getTodaySummary(employeeCode);
  return <TodayCard summary={summary} />;
}

async function FollowUpBlock({ employeeCode }: { employeeCode: string }) {
  const data = await getOverdueFollowUps(employeeCode);
  return <FollowUpCard data={data} />;
}
