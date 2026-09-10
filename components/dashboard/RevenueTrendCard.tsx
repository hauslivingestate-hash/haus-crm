import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { AreaChart } from "@/components/ui/AreaChart";
import { TH_MONTHS } from "@/lib/format";
import { REVENUE_BASIS_LABEL, type RevenueBasis } from "@/lib/deals";
import type { TrendPoint } from "@/lib/salesDashboard";

/* แนวโน้มรายได้ — twelve months of signed commission.
 *
 * DELIBERATELY OUTSIDE THE RANGE FILTER, and the subtitle says so. A trend needs a span
 * longer than the thing being filtered; "วันนี้" would collapse this to a single point,
 * and a chart that can be filtered down to one dot is a chart that will be.
 *
 * Same basis as the card above it — signed, not received. Two revenue figures on one
 * screen counting different things is worse than either choice alone: the reader compares
 * them, and nothing on the page would say they are not comparable.
 */
export function RevenueTrendCard({ rows, basis }: { rows: TrendPoint[]; basis: RevenueBasis }) {
  const data = rows.map((r) => ({
    label: TH_MONTHS[Number(r.month.slice(5, 7)) - 1] ?? r.month,
    value: r.revenue,
  }));

  const everEarned = rows.some((r) => r.revenue > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>แนวโน้มรายได้</CardTitle>
        {/* The basis is named here because the toggle that sets it lives on the card
            ABOVE this one — without it, a chart that visibly redraws would give no clue
            why. The range filter is called out for the opposite reason: it does NOT
            apply. */}
        <span className="text-small text-text-muted">
          12 เดือนล่าสุด · {REVENUE_BASIS_LABEL[basis]} · ไม่ขึ้นกับตัวกรองช่วงเวลา
        </span>
      </CardHeader>
      <CardContent>
        {everEarned ? (
          <AreaChart
            data={data}
            height={180}
            format={(n) => `฿${Math.round(n).toLocaleString("th-TH")}`}
          />
        ) : (
          /* An empty chart is a flat line at zero, which reads as "you earned nothing"
             rather than "nothing has been recorded". With 12 closed deals in the whole
             company and none of them priced, that distinction is the honest one today. */
          <p className="text-body text-text-muted">
            {basis === "close"
              ? "ยังไม่มีดีลที่บันทึกวันเซ็นสัญญาและคอมมิชชั่นไว้ — กรอกในการ์ด \"การปิดการขาย\" ของแต่ละลีด แล้วกราฟจะขึ้นเอง"
              : "ยังไม่มีดีลที่บันทึกวันโอนไว้ — ดีลที่เซ็นแล้วแต่ยังไม่โอนจะเห็นได้ที่ Close"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
