import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { GradeChip } from "@/components/ui/GradeChip";
import type { OverdueFollowUps } from "@/lib/salesDashboard";

/* ติดตามเกินกำหนด — leads past their follow-up window.
 *
 * ── WHY IT IS A WORKLIST AND NOT A COUNT ────────────────────────────────────────
 * Klaichan dropped this card, and its reasoning was sound for a solo agent: the same
 * badges already sort and mark rows on /leads, which is where the follow-up actually
 * gets done, so a number on the landing page added nothing.
 *
 * It earns its place here for a reason that does not apply there — HAUS runs six agents
 * against a rule nobody currently meets. Every graded, active lead in the company is
 * overdue right now. A bare count of "27" in that situation is a number people learn to
 * ignore by the second day. A short, ordered list of WHICH ONES is a morning's work.
 *
 * Hence: the worst eight, never contacted first, each a link straight into the lead.
 * The full count is stated but is not the point of the card.
 *
 * The window per grade comes from ตั้งค่า (A = 7 days, B = 15, the rest off), so this
 * card silently shrinks when someone decides a grade should stop nagging.
 */
export function FollowUpCard({ data }: { data: OverdueFollowUps }) {
  const { count, rows } = data;

  return (
    <Card>
      <CardHeader>
        <CardTitle>ติดตามเกินกำหนด</CardTitle>
        {count > 0 && (
          <span className="num text-small text-red">{count} ลีด</span>
        )}
      </CardHeader>
      <CardContent>
        {count === 0 ? (
          <p className="text-body text-text-muted">
            ตามครบทุกลีดแล้ว — ไม่มีลีดไหนเกินกำหนดติดตาม
          </p>
        ) : (
          <>
            <ul className="flex flex-col">
              {rows.map((r) => (
                <li key={r.leadId}>
                  <Link
                    href={`/leads/${r.leadId}`}
                    className="flex items-center gap-2.5 rounded-md px-2 py-1.5 -mx-2 hover:bg-surface-hover transition-colors"
                  >
                    <GradeChip grade={r.grade ?? "—"} />
                    <span className="min-w-0 flex-1 truncate text-body text-text">
                      {r.leadName ?? r.leadId}
                    </span>
                    <span
                      className={cn(
                        "num shrink-0 text-small",
                        r.days === null ? "text-red" : "text-amber"
                      )}
                    >
                      {r.days === null ? "ยังไม่เคยติดต่อ" : `เกิน ${r.over} วัน`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            {count > rows.length && (
              <Link
                href="/leads"
                className="mt-2 inline-block text-small text-text-muted hover:text-text transition-colors"
              >
                ดูทั้งหมดอีก {count - rows.length} ลีด →
              </Link>
            )}

            <p className="mt-3 text-small text-text-subtle">
              เกรด A ติดตามทุก 7 วัน · เกรด B ทุก 15 วัน — แก้ได้ที่ ตั้งค่า → สีสถานะ &amp; SLA
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
