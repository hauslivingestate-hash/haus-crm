import { Suspense } from "react";
import { RangeBar } from "@/components/dashboard/RangeBar";
import { UnpricedCloses } from "@/components/dashboard/UnpricedCloses";
import { MovementCard } from "@/components/dashboard/MovementCard";
import { TargetRevenueCard } from "@/components/dashboard/TargetRevenueCard";
import { KpiRow } from "@/components/dashboard/KpiRow";
import { RevenueTrendCard } from "@/components/dashboard/RevenueTrendCard";
import { FollowUpCard } from "@/components/dashboard/FollowUpCard";
import { DailyPlan } from "@/components/DailyPlan";
import { BacklogCard } from "@/components/BacklogCard";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  type FunnelStep,
  getActivityTotals,
  getLeadFunnel,
  getOverdueFollowUps,
  getOwnerFunnel,
  getRevenueSummary,
  getRevenueTrend,
  getStageMovement,
  getStandingRevenueTargets,
  getStandingWorkTargets,
  getUnpricedCloses,
  getWorkTargets,
} from "@/lib/salesDashboard";
import { resolveRange, type Range } from "@/lib/range";
import { asRevenueBasis, type RevenueBasis } from "@/lib/deals";
import { getPlanData } from "@/lib/plan";

/* แดชบอร์ดขาย — the scoreboard for whoever is signed in.
 *
 * ── THE LAYOUT ──────────────────────────────────────────────────────────────────
 * Klaichan's two-column shape (Ben, 2026-09-10) with the "Shopall" reference's KPI row on
 * top (Ben, 2026-09-15 — the hybrid, chosen over the reference's full-width rows so the
 * planner stays above the fold):
 *
 *   the banner        outstanding work, ABOVE the filter, because a deal missing its
 *                     commission is missing it in every period
 *   the filter row    sticky, above everything it scopes — never a filter inside a card
 *   left column 2/3   the business: four headline tiles, the target bar, the trend,
 *                     then the pipeline
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

  // ONE funnel read for two cards. The ลีดใหม่ tile and ความเคลื่อนไหว both need it, and
  // they sit in different Suspense blocks, so the promise is created here and handed to
  // both — awaiting it twice resolves once. Not two calls to the same RPC.
  const funnel = getLeadFunnel(employeeCode, range);

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
          <Suspense
            fallback={
              <>
                <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-28 rounded-lg" />
                  ))}
                </div>
                <Skeleton className="h-36 rounded-lg" />
              </>
            }
          >
            <RevenueBlock
              employeeCode={employeeCode}
              range={range}
              basis={basis}
              canSetTargets={canSetTargets}
              funnel={funnel}
            />
          </Suspense>

          <Suspense fallback={<Skeleton className="h-60 rounded-lg" />}>
            <TrendBlock employeeCode={employeeCode} basis={basis} />
          </Suspense>

          <Suspense fallback={<Skeleton className="h-80 rounded-lg" />}>
            <MovementBlock
              employeeCode={employeeCode}
              range={range}
              canSetTargets={canSetTargets}
              searchParams={searchParams}
              funnel={funnel}
            />
          </Suspense>
        </div>

        {/* ---- right 1/3: the day ----
            Deliberately NOT scoped by the range bar: today's plan, what is overdue and
            what is unscheduled are all true regardless of which period is being
            inspected, and letting "ปีนี้" imply a year's worth of overdue follow-ups
            would be a lie.

            THE ORDER IS KLAICHAN'S AND IT IS ARGUED: the day you actually planned comes
            first; ติดตามเกินกำหนด is work that is already due, so it outranks the undated
            pile; รายการรอ last, because nothing in it has a deadline.

            One Suspense around the plan and the backlog, because they read the same
            getPlanData() — splitting them would fetch it twice. */}
        <div className="flex flex-col gap-4">
          <Suspense fallback={<Skeleton className="h-96 rounded-lg" />}>
            <DayBlock employeeCode={employeeCode} />
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

/* The tiles and the target bar in one block: both read the same summary, and a KPI row
   that resolved before the bar under it would show a % with no bar to explain it. */
async function RevenueBlock({
  employeeCode,
  range,
  basis,
  canSetTargets,
  funnel,
}: {
  employeeCode: string;
  range: Range;
  basis: RevenueBasis;
  canSetTargets: boolean;
  funnel: Promise<FunnelStep[]>;
}) {
  const [summary, standing, steps] = await Promise.all([
    getRevenueSummary(employeeCode, range, basis),
    // Loaded with the card rather than on demand: the editor is one tap away and a
    // spinner inside a form that just opened reads as a broken form.
    canSetTargets ? getStandingRevenueTargets(employeeCode) : Promise.resolve({}),
    funnel,
  ]);
  return (
    <>
      <KpiRow summary={summary} newLeads={steps[0]?.cohort ?? 0} range={range} />
      <TargetRevenueCard
        summary={summary}
        range={range}
        standing={standing}
        employeeCode={employeeCode}
        canEdit={canSetTargets}
      />
    </>
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
   actions against stage moves as though they were the same unit. They are not.

   Six reads, all in parallel. They are one card because they answer one question, and
   because the card's two halves have to agree on the same window — fetching them in
   separate Suspense blocks would let one half render against a range the other had not
   caught up with yet. */
async function MovementBlock({
  employeeCode,
  range,
  canSetTargets,
  searchParams,
  funnel: funnelP,
}: {
  employeeCode: string;
  range: Range;
  canSetTargets: boolean;
  searchParams: { range?: string; from?: string; to?: string };
  funnel: Promise<FunnelStep[]>;
}) {
  const [activity, funnel, stages, ownerFunnel, work, standing] = await Promise.all([
    getActivityTotals(employeeCode, range),
    funnelP,
    getStageMovement(employeeCode, range),
    getOwnerFunnel(employeeCode, range),
    getWorkTargets(employeeCode, range),
    // Loaded with the card rather than on demand: the editor is one tap away and a
    // spinner inside a form that just opened reads as a broken form.
    canSetTargets ? getStandingWorkTargets(employeeCode, range.period) : Promise.resolve({}),
  ]);

  return (
    <MovementCard
      activity={activity}
      funnel={funnel}
      stages={stages}
      ownerFunnel={ownerFunnel}
      // The buyer funnel's cohort IS the intake count — leads received in this window.
      // Reading it from the funnel rather than asking again means the "Lead" bar and the
      // funnel's denominator can never disagree.
      newLeads={funnel[0]?.cohort ?? 0}
      range={{
        label: range.label,
        period: range.period,
        elapsed: range.elapsed,
        compareLabel: range.compareLabel,
      }}
      targets={work.resolved}
      standingTargets={standing}
      canSetTargets={canSetTargets}
      employeeCode={employeeCode}
      searchParams={searchParams}
    />
  );
}

/* THE REAL PLANNER, NOT A POINTER (Ben, 2026-09-10: "make it like klaichan").
 *
 * This renders the SAME component as /today. Not a compact copy of it — the same file.
 * That is the whole reason this is safe: there is exactly one planner in the app, so the
 * dashboard and /today cannot disagree about whether a task is done, and every future
 * change to it lands on both at once. My earlier objection was to a second implementation,
 * which is a different thing and would have been wrong.
 *
 * (Until 2026-09-15 /today carried its own scoped palette and this card deliberately did
 * not. There is one palette now, so the two renders are identical.)
 *
 * `getPlanData()` reads the signed-in person's own plan — it takes no employee code and
 * cannot be pointed at anyone else, which is why this block does not receive one.
 */
async function DayBlock({ employeeCode }: { employeeCode: string }) {
  const [plan, followUps] = await Promise.all([
    getPlanData(),
    getOverdueFollowUps(employeeCode),
  ]);
  return (
    <>
      {/* No employee row → no plan. The page above already renders its own empty state
          for an account in that position, so this stays quiet rather than repeating it. */}
      {plan && <DailyPlan plan={plan} />}
      <FollowUpCard data={followUps} />
      {plan && <BacklogCard plan={plan} />}
    </>
  );
}

