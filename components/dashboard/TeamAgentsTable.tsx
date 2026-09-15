import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";
import { formatBaht } from "@/lib/format";
import type { AgentRevenue } from "@/lib/teamDashboard";

/* รายคน — the team's number broken down by who signed it.
 *
 * Best first, and everyone is listed. A member with nothing signed in the window is a
 * fact the leader needs more than the top row is; hiding zeros would turn the table into
 * a leaderboard, which เซลล์ใหม่ already is.
 *
 * Two percentages and they mean different things, so they sit in different columns:
 *   ส่วนแบ่งทีม   this person's slice of what the team signed — always adds to 100
 *   เป้าตัวเอง    this person against THEIR OWN target — the same figure their own
 *                dashboard shows; "ไม่ได้ตั้ง" when the CEO has not given them one
 */
export function TeamAgentsTable({
  agents,
  teamActual,
  rangeLabel,
}: {
  agents: AgentRevenue[];
  teamActual: number;
  rangeLabel: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>รายคน · {rangeLabel}</CardTitle>
        <span className="num text-small text-text-subtle">{agents.length} คน</span>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {agents.length === 0 ? (
          <p className="py-6 text-center text-small text-text-subtle">
            ยังไม่มีสมาชิกในทีม — ใส่คนเข้าทีมได้ที่ ตั้งค่า ▸ ทีม
          </p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>ชื่อ</TH>
                <TH className="text-right">รายได้</TH>
                <TH className="text-right">ดีล</TH>
                <TH className="text-right">ส่วนแบ่งทีม</TH>
                <TH className="text-right">เป้าตัวเอง</TH>
              </TR>
            </THead>
            <TBody>
              {agents.map((a) => {
                const own = a.target > 0 ? Math.round((a.actual / a.target) * 100) : null;
                return (
                  <TR key={a.code}>
                    <TD>
                      <Link
                        href={`/team/${encodeURIComponent(a.code)}`}
                        className="inline-flex items-center gap-2 text-text transition-colors hover:text-accent-ink"
                      >
                        <Avatar name={a.nickname} tone="neutral" className="size-6 text-label" />
                        <span className="font-medium">{a.nickname}</span>
                        <span className="num text-label text-text-subtle">{a.code}</span>
                      </Link>
                    </TD>
                    <TD className={cn("num text-right", a.actual > 0 ? "text-text" : "text-text-subtle")}>
                      {formatBaht(a.actual)}
                    </TD>
                    <TD className="num text-right">{a.cases}</TD>
                    <TD className="num text-right text-text-muted">
                      {teamActual > 0 ? `${Math.round((a.actual / teamActual) * 100)}%` : "—"}
                    </TD>
                    <TD className="num text-right">
                      {own == null ? (
                        <span className="text-text-subtle">ไม่ได้ตั้ง</span>
                      ) : (
                        <span className={cn("font-medium", own >= 100 ? "text-green" : "text-text")}>{own}%</span>
                      )}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
