"use client";

/* ⚠️ CLIENT, and it has to be. `AreaChart` is a client component and its `format` prop is
   a function — functions cannot cross the server→client boundary, so a server component
   rendering it crashes at request time with "Functions cannot be passed directly to
   Client Components". TypeScript cannot see this; only opening the page does.

   The alternative was giving AreaChart a serializable format option (`format="baht"`),
   which would bend a shared primitive around one caller. A card that draws an
   interactive chart belonging on the client is the ordinary answer.

   Everything it receives — rows, basis — is serializable, and lib/deals + lib/format are
   pure modules with no server-only imports, so nothing else has to move. */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { AreaChart } from "@/components/ui/AreaChart";
import { RevenueBasisToggle } from "@/components/dashboard/RevenueBasisToggle";
import { TH_MONTHS } from "@/lib/format";
import type { RevenueBasis } from "@/lib/deals";
import type { TrendPoint } from "@/lib/salesDashboard";

/* แนวโน้มรายได้ — twelve months of signed commission.
 *
 * DELIBERATELY OUTSIDE THE RANGE FILTER, and the subtitle says so. A trend needs a span
 * longer than the thing being filtered; "วันนี้" would collapse this to a single point,
 * and a chart that can be filtered down to one dot is a chart that will be.
 *
 * ALWAYS the same basis as the card above it, because both read `?basis=` rather than
 * holding their own state. Two revenue figures on one screen counting different things is
 * worse than either choice alone: the reader compares them, and nothing on the page would
 * say they are not comparable. Two toggles, one number.
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
        {/* One row, because CardHeader is a fixed h-12 — a stacked title and subtitle
            would overflow it. The range filter is called out because it does NOT apply
            here; the basis is no longer spelled out in words, since the toggle beside it
            already says which one is on. */}
        <div className="flex min-w-0 items-baseline gap-2">
          <CardTitle>แนวโน้มรายได้</CardTitle>
          <span className="truncate text-small text-text-muted">
            12 เดือนล่าสุด · ไม่ขึ้นกับตัวกรองช่วงเวลา
          </span>
        </div>
        {/* Its OWN toggle, not just an echo of the card above.
            Ben, 2026-09-10: the toggle belongs on both revenue surfaces. Both write the
            same `?basis=` param, so flipping either one flips both — there is no second
            piece of state that can drift out of sync with the first, and the chart is
            reachable without scrolling back up to the card that owns the setting. */}
        <RevenueBasisToggle active={basis} />
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
