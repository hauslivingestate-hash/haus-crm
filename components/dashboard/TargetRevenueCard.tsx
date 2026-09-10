"use client";

import * as React from "react";
import { Pencil, TrendingUp, TrendingDown, Minus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { formatBaht } from "@/lib/format";
import { PERIOD_LABEL, type Range } from "@/lib/range";
import { RevenueTargetForm } from "@/components/dashboard/RevenueTargetForm";
import { RevenueBasisToggle } from "@/components/dashboard/RevenueBasisToggle";
import { REVENUE_BASIS_HINT } from "@/lib/deals";
import type { RevenueSummary } from "@/lib/salesDashboard";

/* เป้ารายได้ — commission SIGNED against the target for the selected period.
 *
 * Signed, not received: this card scores the sales game, so a deal counts the day the
 * contract was signed rather than the day the transfer clears. See lib/deals.ts — the
 * two figures are supposed to differ, and this one says so in its own footer.
 *
 * THE BAR CARRIES THREE FACTS, which is one more than a progress bar usually does and
 * the reason it earns the space:
 *   1. how far along the money is (the fill),
 *   2. how far along the PERIOD is (the pace marker), and
 *   3. where the previous equivalent period ended up (the delta).
 *
 * Without (2) the bar is unreadable mid-month: 40% of the target on the 3rd is four
 * times ahead, on the 27th it is a crisis, and a bare fill draws both identically. The
 * marker is the honest part of this card.
 *
 * ── WHO SEES ตั้งเป้า ────────────────────────────────────────────────────────────
 * Only `targets.set` holders, and this card only ever shows the signed-in person's own
 * numbers — so a sale never sees it. Ben, 2026-09-10: the CEO sets the sale's target,
 * not the sale. A leader setting a SALE's figure does it on that person's record.
 */
export function TargetRevenueCard({
  summary,
  range,
  standing,
  employeeCode,
  canEdit,
}: {
  summary: RevenueSummary;
  range: Range;
  /** period → baht, for the inline editor. */
  standing: Record<string, number>;
  employeeCode: string;
  canEdit: boolean;
}) {
  const [editing, setEditing] = React.useState(false);
  const { actual, target, previous, cases, elapsed } = summary;

  const pct = target > 0 ? (actual / target) * 100 : 0;
  const shown = Math.min(100, pct);
  const met = pct >= 100;
  // Behind = the money is further behind than the calendar. Only meaningful once a
  // target exists AND the period is genuinely part-way through.
  const behind = target > 0 && elapsed < 1 && pct < elapsed * 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle>เป้ารายได้ · {range.label}</CardTitle>
        <div className="flex items-center gap-3">
          <RevenueBasisToggle active={summary.basis} />
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditing((e) => !e)}
              className="inline-flex items-center gap-1 text-small font-medium text-accent transition-colors hover:text-accent-hover"
            >
              {editing ? <X size={13} strokeWidth={2} /> : <Pencil size={12} strokeWidth={2} />}
              {editing ? "ปิด" : "ตั้งเป้า"}
            </button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {editing ? (
          <RevenueTargetForm
            employeeCode={employeeCode}
            standing={standing}
            onDone={() => setEditing(false)}
          />
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
              <div>
                {/* Proportional figures, not tabular: equal-width digits make a
                    display-size number read loose. Tabular is for columns. */}
                <div className="text-[2rem] font-semibold leading-none tracking-tight text-text">
                  {formatBaht(actual)}
                </div>
                <div className="mt-1.5 text-small text-text-muted">
                  {target > 0 ? (
                    <>
                      จากเป้า{" "}
                      <span className="num font-semibold text-text">{formatBaht(target)}</span>{" "}
                      {PERIOD_LABEL[summary.targetPeriod]}
                      {summary.targetIsOverride ? " (ตั้งเฉพาะช่วงนี้)" : ""}
                    </>
                  ) : (
                    "ยังไม่ได้ตั้งเป้าสำหรับช่วงนี้"
                  )}
                </div>
              </div>
              <div className="text-right">
                <div
                  className={cn(
                    "num text-[1.35rem] font-semibold leading-none",
                    met ? "text-green" : behind ? "text-amber" : "text-text"
                  )}
                >
                  {target > 0 ? `${Math.round(pct)}%` : "—"}
                </div>
                <div className="mt-1 text-small text-text-subtle">{cases} ดีลที่ปิดได้</div>
              </div>
            </div>

            {/* The pace tick sits on the track rather than inside the fill, so it stays
                visible whether the fill has passed it or not. */}
            <div className="relative mt-4 h-3 overflow-hidden rounded-full bg-surface-2">
              {target > 0 && (
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-500",
                    met ? "bg-green" : "bg-accent"
                  )}
                  // A floor of 2% so a small non-zero amount is still visible as a mark
                  // rather than reading as nothing at all.
                  style={{ width: `${Math.max(shown, actual > 0 ? 2 : 0)}%` }}
                />
              )}
              {target > 0 && elapsed < 1 && (
                <span
                  title={`ผ่านมาแล้ว ${Math.round(elapsed * 100)}% ของช่วงเวลา`}
                  className="absolute top-0 h-full w-0.5 bg-text-muted"
                  style={{ left: `${elapsed * 100}%` }}
                />
              )}
            </div>

            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-small">
              <span className="text-text-subtle">
                {target === 0
                  ? "ตั้งเป้าเพื่อดูความคืบหน้า"
                  : elapsed < 1
                    ? `ผ่านมาแล้ว ${Math.round(elapsed * 100)}% ของช่วงเวลา`
                    : "จบช่วงเวลาแล้ว"}
              </span>
              <Delta actual={actual} previous={previous} label={range.compareLabel} />
            </div>

            {behind && (
              <p className="mt-3 rounded-md bg-amber-bg px-3 py-2 text-small text-amber">
                ตามหลังจังหวะเวลาอยู่ · ต้องได้อีก{" "}
                {formatBaht(Math.max(0, Math.round(target * elapsed) - actual))} จึงจะทันเป้า
              </p>
            )}

            <p className="mt-3 text-small text-text-subtle">
              ค่าคอมเต็มจำนวนที่บริษัทได้รับจากเจ้าของ (ยังไม่หักภาษี/ส่วนแบ่ง) · {REVENUE_BASIS_HINT[summary.basis]}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** Period-over-period change. Suppressed entirely for a custom range, which has no prior
    period — showing one would label an invented window as something it is not. */
function Delta({
  actual,
  previous,
  label,
}: {
  actual: number;
  previous: number | null;
  label: string | null;
}) {
  if (previous == null || !label) return null;

  // A rise from zero is not "+∞%" and not "+100%" — it is a start, and the only honest
  // thing to show is that it began.
  if (previous === 0) {
    return (
      <span className="flex items-center gap-1 text-text-subtle">
        {actual > 0 ? (
          <TrendingUp size={12} strokeWidth={2} className="text-green" />
        ) : (
          <Minus size={12} strokeWidth={2} />
        )}
        {actual > 0 ? `เริ่มจากศูนย์ ${label}` : `ไม่มีรายได้ ${label}`}
      </span>
    );
  }

  const change = Math.round(((actual - previous) / previous) * 100);
  const Icon = change > 0 ? TrendingUp : change < 0 ? TrendingDown : Minus;
  const tone = change > 0 ? "text-green" : change < 0 ? "text-red" : "text-text-subtle";
  return (
    <span className="flex items-center gap-1 text-text-subtle">
      <Icon size={12} strokeWidth={2} className={tone} />
      <span className={cn("num font-semibold", tone)}>
        {change > 0 ? "+" : ""}
        {change}%
      </span>{" "}
      {label}
    </span>
  );
}
