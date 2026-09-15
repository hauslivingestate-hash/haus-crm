"use client";

import * as React from "react";
import { Pencil, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { formatBaht } from "@/lib/format";
import { PERIOD_LABEL, type Range } from "@/lib/range";
import { RevenueTargetForm } from "@/components/dashboard/RevenueTargetForm";
import { RevenueBasisToggle } from "@/components/dashboard/RevenueBasisToggle";
import { REVENUE_BASIS_HINT } from "@/lib/deals";
import type { RevenueSummary } from "@/lib/salesDashboard";
import type { TargetScope } from "@/lib/targetScope";

/* เป้ารายได้ — commission SIGNED against the target for the selected period.
 *
 * Signed, not received: this card scores the sales game, so a deal counts the day the
 * contract was signed rather than the day the transfer clears. See lib/deals.ts — the
 * two figures are supposed to differ, and this one says so in its own footer.
 *
 * THE HEADLINE FIGURES ARE NOT HERE. Actual, % of target, deal count and the period
 * delta live in the KPI tiles above (KpiRow, 2026-09-15); this card is the one thing a
 * tile cannot draw — the bar, which carries TWO facts:
 *   1. how far along the money is (the fill), and
 *   2. how far along the PERIOD is (the pace marker).
 *
 * Without (2) the bar is unreadable mid-month: 40% of the target on the 3rd is four
 * times ahead, on the 27th it is a crisis, and a bare fill draws both identically. The
 * marker is the honest part of this card.
 *
 * ── WHO SEES ตั้งเป้า ────────────────────────────────────────────────────────────
 * Only `targets.set` holders, and on the sales tab this card only ever shows the
 * signed-in person's own numbers — so a sale never sees it. Ben, 2026-09-10: the CEO
 * sets the sale's target, not the sale. A leader setting a SALE's figure does it on that
 * person's record. On the ทีม tab the same card carries the TEAM's number (`scope`), and
 * the same permission decides who may edit it.
 */
export function TargetRevenueCard({
  summary,
  range,
  standing,
  scope,
  canEdit,
}: {
  summary: RevenueSummary;
  range: Range;
  /** period → baht, for the inline editor. */
  standing: Record<string, number>;
  /** Whose target — a person's or a team's. Decides which save the editor calls. */
  scope: TargetScope;
  canEdit: boolean;
}) {
  const [editing, setEditing] = React.useState(false);
  const { actual, target, elapsed } = summary;

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
              className="inline-flex items-center gap-1 text-small font-medium text-accent-ink transition-colors hover:text-accent"
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
            scope={scope}
            standing={standing}
            onDone={() => setEditing(false)}
          />
        ) : (
          <>
            <div className="text-small text-text-muted">
              {target > 0 ? (
                <>
                  <span className="num font-semibold text-text">{formatBaht(actual)}</span> จากเป้า{" "}
                  <span className="num font-semibold text-text">{formatBaht(target)}</span>{" "}
                  {PERIOD_LABEL[summary.targetPeriod]}
                  {summary.targetIsOverride ? " (ตั้งเฉพาะช่วงนี้)" : ""}
                </>
              ) : (
                "ยังไม่ได้ตั้งเป้าสำหรับช่วงนี้"
              )}
            </div>

            {/* The pace tick sits on the track rather than inside the fill, so it stays
                visible whether the fill has passed it or not. */}
            <div className="relative mt-3 h-3 overflow-hidden rounded-full bg-surface-2">
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

            <div className="mt-2.5 text-small text-text-subtle">
              {target === 0
                ? "ตั้งเป้าเพื่อดูความคืบหน้า"
                : elapsed < 1
                  ? `ผ่านมาแล้ว ${Math.round(elapsed * 100)}% ของช่วงเวลา`
                  : "จบช่วงเวลาแล้ว"}
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
