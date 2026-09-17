"use client";

/* ⚠️ CLIENT, and it has to be. `AreaChart` is a client component and its `format` prop is
   a function — functions cannot cross the server→client boundary, so a server component
   rendering it crashes at request time with "Functions cannot be passed directly to
   Client Components". TypeScript cannot see this; only opening the page does.

   The alternative was giving AreaChart a serializable format option (`format="baht"`),
   which would bend a shared primitive around one caller. A card that draws an
   interactive chart belonging on the client is the ordinary answer.

   Everything it receives — rows, basis, monthlyTarget — is serializable, and lib/deals +
   lib/format are pure modules with no server-only imports, so nothing else has to move. */

import * as React from "react";
import { LineChart as LineIcon, Table2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { AreaChart } from "@/components/ui/AreaChart";
import { SegmentedItem, SegmentedTrack } from "@/components/ui/Segmented";
import { RevenueBasisToggle } from "@/components/dashboard/RevenueBasisToggle";
import { formatBaht, formatBahtShort, formatNumber, TH_MONTHS } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { RevenueBasis } from "@/lib/deals";
import type { TrendPoint } from "@/lib/salesDashboard";

/* แนวโน้มรายได้ — twelve months of signed commission.
 *
 * DELIBERATELY OUTSIDE THE RANGE FILTER, and the subtitle says so. A trend needs a span
 * longer than the thing being filtered; "วันนี้" would collapse this to a single point,
 * and a chart that can be filtered down to one dot is a chart that will be.
 *
 * ALWAYS the same basis as the cards around it, because they all read `?basis=` rather
 * than holding their own state. Two revenue figures on one screen counting different
 * things is worse than either choice alone: the reader compares them, and nothing on the
 * page would say they are not comparable. Three toggles, one number.
 *
 * ── ONE SERIES AT A TIME (Klaichan's rule, adopted 2026-09-17) ──────────────────
 * Baht and a case count cannot share a y-axis, so รายได้ ⇄ จำนวนเคส SWITCHES the series
 * rather than overlaying them. No dual axis, and therefore no legend — the toggle names
 * what is drawn. The target line is money, so it only appears on the money view: a baht
 * threshold against a count of deals would be a line meaning nothing.
 *
 * ── THE TABLE IS NOT A NICETY ───────────────────────────────────────────────────
 * Every value on the chart is otherwise reachable only by hovering, which rules out
 * touch, keyboards and screen readers. The table view is the same twelve numbers as text.
 *
 * The metric and the view are LOCAL state, unlike the basis: they change what you are
 * looking at, not what the page is counting, so nothing else on the dashboard has to
 * agree with them and they do not belong in the URL.
 */
type Metric = "revenue" | "cases";

const METRICS: { id: Metric; label: string; money: boolean }[] = [
  { id: "revenue", label: "รายได้", money: true },
  { id: "cases", label: "จำนวนเคส", money: false },
];

export function RevenueTrendCard({
  rows,
  basis,
  monthlyTarget = 0,
}: {
  rows: TrendPoint[];
  basis: RevenueBasis;
  /** The STANDING monthly revenue target, drawn as the threshold line. 0 hides it —
      a chart with a target of zero would say everyone is permanently ahead. */
  monthlyTarget?: number;
}) {
  const [metric, setMetric] = React.useState<Metric>("revenue");
  const [asTable, setAsTable] = React.useState(false);
  const m = METRICS.find((x) => x.id === metric)!;

  const data = rows.map((r) => ({ label: monthLabel(r.month), value: r[metric] }));
  const full = m.money ? (n: number) => `฿${Math.round(n).toLocaleString("th-TH")}` : formatNumber;
  const axis = m.money ? formatBahtShort : formatNumber;

  const everRecorded = rows.some((r) => r[metric] > 0);
  // Only the best month is called out in words. A number on every point is chaos and goes
  // unread; the axis and the hover carry the rest.
  const peak = rows.reduce<TrendPoint | null>(
    (best, r) => (best == null || r[metric] > best[metric] ? r : best),
    null
  );

  return (
    <Card>
      <CardHeader>
        {/* One row, because CardHeader is a fixed h-12 — a stacked title and subtitle
            would overflow it. */}
        <div className="flex min-w-0 items-baseline gap-2">
          <CardTitle>แนวโน้ม{m.money ? "รายได้" : "เคส"}</CardTitle>
          <span className="hidden truncate text-small text-text-muted sm:inline">
            12 เดือนล่าสุด · ไม่ขึ้นกับตัวกรองช่วงเวลา
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <SegmentedTrack aria-label="ตัววัด">
            {METRICS.map((x) => (
              <SegmentedItem key={x.id} size="sm" on={x.id === metric} onClick={() => setMetric(x.id)}>
                {x.label}
              </SegmentedItem>
            ))}
            <SegmentedItem
              size="icon"
              on={asTable}
              onClick={() => setAsTable((t) => !t)}
              aria-label={asTable ? "ดูเป็นกราฟ" : "ดูเป็นตาราง"}
              title={asTable ? "ดูเป็นกราฟ" : "ดูเป็นตาราง"}
              className="size-6"
            >
              {asTable ? <LineIcon size={12} strokeWidth={2} /> : <Table2 size={12} strokeWidth={2} />}
            </SegmentedItem>
          </SegmentedTrack>
          {/* Its OWN basis toggle, not just an echo of the card above.
              Ben, 2026-09-10: the toggle belongs on every revenue surface. They all write
              the same `?basis=` param, so flipping one flips all — there is no second
              piece of state that can drift, and the chart is reachable without scrolling
              back up to the card that owns the setting. */}
          <RevenueBasisToggle active={basis} />
        </div>
      </CardHeader>

      <CardContent>
        {asTable ? (
          <TrendTable rows={rows} metric={metric} format={full} />
        ) : everRecorded ? (
          <>
            <AreaChart
              data={data}
              height={208}
              // Money only: a baht threshold drawn against a count of deals is a line at
              // an arbitrary height, and the reader has no way to know that.
              goal={m.money ? monthlyTarget : 0}
              goalLabel="เป้า"
              format={full}
              formatAxis={axis}
            />
            {peak && peak[metric] > 0 && (
              <p className="mt-2 text-label text-text-subtle">
                เดือนที่ดีที่สุด{" "}
                <span className="num font-semibold text-text">{monthLabel(peak.month)}</span> ·{" "}
                <span className="num">{full(peak[metric])}</span>
              </p>
            )}
          </>
        ) : (
          /* An empty chart is a flat line at zero, which reads as "you earned nothing"
             rather than "nothing has been recorded". With so few priced deals in the
             company, that distinction is the honest one today. */
          <p className="text-body text-text-muted">
            {!m.money
              ? "ยังไม่มีดีลที่ปิดได้ในช่วง 12 เดือนนี้"
              : basis === "close"
                ? "ยังไม่มีดีลที่บันทึกวันเซ็นสัญญาและคอมมิชชั่นไว้ — กรอกในการ์ด \"การปิดการขาย\" ของแต่ละลีด แล้วกราฟจะขึ้นเอง"
                : "ยังไม่มีดีลที่บันทึกวันโอนไว้ — ดีลที่เซ็นแล้วแต่ยังไม่โอนจะเห็นได้ที่ Close"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** The table twin. A quiet month reads "—" rather than 0: nothing was recorded, which is
    not the same claim as a recorded zero, and the chart cannot draw that distinction. */
function TrendTable({
  rows,
  metric,
  format,
}: {
  rows: TrendPoint[];
  metric: Metric;
  format: (n: number) => string;
}) {
  return (
    <div className="max-h-[232px] overflow-y-auto">
      <table className="w-full text-small">
        <thead className="sticky top-0 bg-surface">
          <tr className="text-left text-label text-text-subtle">
            <th className="pb-1.5 font-medium">เดือน</th>
            <th className="pb-1.5 text-right font-medium">{metric === "revenue" ? "รายได้" : "เคส"}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.month}>
              <td className="py-1.5 text-text-muted">{monthLabel(r.month)}</td>
              <td className={cn("num py-1.5 text-right", r[metric] > 0 ? "font-medium" : "text-text-subtle")}>
                {r[metric] > 0 ? format(r[metric]) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* 'YYYY-MM' → 'ส.ค.', with the Thai year appended in January so a 12-month window that
   crosses new year does not read as one continuous stretch — two "ม.ค." labels twelve
   months apart is the one ambiguity a bare month name cannot survive. */
function monthLabel(key: string): string {
  const m = Number(key.slice(5, 7));
  const label = TH_MONTHS[m - 1] ?? key;
  return m === 1 ? `${label} ${String(Number(key.slice(0, 4)) + 543).slice(2)}` : label;
}
