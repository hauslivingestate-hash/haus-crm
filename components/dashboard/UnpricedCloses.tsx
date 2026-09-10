import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { DEAL_GAP_LABEL } from "@/lib/deals";
import type { UnpricedClose } from "@/lib/salesDashboard";

/* ดีลที่ปิดแล้วแต่ยังไม่ได้กรอกตัวเลข.
 *
 * Ported from Klaichan's UnpricedCloses. It sits ABOVE the range filter and outside
 * everything the filter scopes, because it is an undone job rather than a fact about
 * the selected window — a deal missing its commission is missing it in every period.
 *
 * Nothing outstanding must leave NO trace: the caller renders this only when there are
 * rows, so an empty state cannot show up as an unexplained gap above the dashboard.
 *
 * Why it earns the top of the page: a closed case with no commission is revenue the
 * whole app cannot see. It is absent from the revenue card, from any target, and from
 * the company's idea of how the month went — and it is invisible precisely because
 * nobody is looking at the lead any more.
 */
export function UnpricedCloses({ rows }: { rows: UnpricedClose[] }) {
  return (
    <div className="rounded-lg border border-amber/30 bg-amber-bg p-4">
      <div className="flex items-start gap-2.5">
        <AlertTriangle size={16} strokeWidth={2} className="mt-0.5 shrink-0 text-amber" />
        <div className="min-w-0 flex-1">
          <h2 className="text-h2">
            ดีลที่ปิดแล้ว แต่ยังไม่ได้กรอกตัวเลข ({rows.length})
          </h2>
          <p className="mt-0.5 text-small text-text-muted">
            ยอดเหล่านี้ยังไม่ถูกนับเป็นรายได้ที่ไหนเลย — เปิดลีดแล้วกรอกในการ์ด &quot;การปิดการขาย&quot;
          </p>

          <ul className="mt-3 flex flex-col gap-1">
            {rows.map((r) => (
              <li key={r.leadId}>
                <Link
                  href={`/leads/${r.leadId}`}
                  className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-md px-2 py-1.5 -mx-2 hover:bg-surface-hover transition-colors"
                >
                  <span className="num text-small text-text-subtle">{r.leadId}</span>
                  <span className="text-body text-text truncate">{r.leadName ?? "—"}</span>
                  <span className="text-small text-text-muted">
                    ขาด {r.gaps.map((g) => DEAL_GAP_LABEL[g]).join(" · ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
