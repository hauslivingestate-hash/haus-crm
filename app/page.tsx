import { Topbar } from "@/components/Topbar";
import { Stat } from "@/components/ui/Stat";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { PipelineBoard } from "@/components/PipelineBoard";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { StatusBadge } from "@/components/ui/Dot";
import { GradeChip } from "@/components/ui/GradeChip";
import { Avatar } from "@/components/ui/Avatar";
import { Pill } from "@/components/ui/Pill";
import { getCrm, getListings, getSaleStatus, getPotentialCount } from "@/lib/queries";
import { formatBaht, formatNumber, formatThaiDate } from "@/lib/format";
import { leadStatusDot } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [crm, listings, sales, potentialCount] = await Promise.all([
    getCrm(),
    getListings(),
    getSaleStatus(),
    getPotentialCount(),
  ]);

  const active = crm.filter((c) => c.lead_status === "Active");
  const wins = crm.filter((c) => c.lead_status === "Win");
  const pipelineValue = active.reduce((a, c) => a + (c.budget ?? 0), 0);
  const commission = crm.reduce((a, c) => a + (c.commission ?? 0), 0);

  return (
    <>
      <Topbar title="แดชบอร์ด" subtitle={`ภาพรวม · ${formatThaiDate(new Date())}`} />
      <div className="p-6 space-y-6">
        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat
            label="ทรัพย์ทั้งหมด"
            value={formatNumber(listings.length)}
            hint={`${potentialCount} รายการเข้าเกณฑ์ A List`}
          />
          <Stat
            label="Lead ที่ Active"
            value={formatNumber(active.length)}
            delta={{ value: "+3", positive: true }}
            hint="ในไปป์ไลน์ตอนนี้"
          />
          <Stat label="มูลค่าไปป์ไลน์" value={formatBaht(pipelineValue)} hint="งบรวมดีลที่ Active" />
          <Stat
            label="คอมมิชชั่นปิดได้"
            value={formatBaht(commission)}
            delta={{ value: `${wins.length} ดีล`, positive: true }}
            hint="Win ทั้งหมด"
          />
        </div>

        {/* Pipeline */}
        <Card>
          <CardHeader>
            <CardTitle>ไปป์ไลน์การขาย</CardTitle>
            <Pill tone="accent">{formatBaht(pipelineValue)}</Pill>
          </CardHeader>
          <CardContent className="p-3">
            <PipelineBoard rows={crm} />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Sales leaderboard */}
          <Card>
            <CardHeader>
              <CardTitle>ผลงานเซล</CardTitle>
              <span className="text-small text-text-muted">All-time</span>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <THead>
                  <TR>
                    <TH>เซล</TH>
                    <TH>โซน</TH>
                    <TH className="text-right">ทรัพย์</TH>
                    <TH className="text-right">ปิดได้</TH>
                    <TH className="text-right">มูลค่า</TH>
                  </TR>
                </THead>
                <TBody>
                  {sales.map((s) => (
                    <TR key={s.employee_code}>
                      <TD>
                        <span className="inline-flex items-center gap-2">
                          <Avatar name={s.first_name_en ?? s.nickname} tone="crimson" />
                          <span>
                            {s.nickname}
                            <span className="text-label text-text-subtle num ml-1">
                              {s.employee_code}
                            </span>
                          </span>
                        </span>
                      </TD>
                      <TD className="text-small text-text-muted num">{s.zones ?? "—"}</TD>
                      <TD className="text-right num">{formatNumber(s.total_listings)}</TD>
                      <TD className="text-right num">{formatNumber(s.total_matches)}</TD>
                      <TD className="text-right num text-accent">{formatBaht(s.total_match_value)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>

          {/* Recent CRM leads */}
          <Card>
            <CardHeader>
              <CardTitle>Lead ล่าสุด</CardTitle>
              <span className="text-small text-text-muted num">{crm.length} รายการ</span>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <THead>
                  <TR>
                    <TH>ลูกค้า</TH>
                    <TH>เกรด</TH>
                    <TH>สถานะ</TH>
                    <TH className="text-right">งบ</TH>
                    <TH className="text-right">ติดตามล่าสุด</TH>
                  </TR>
                </THead>
                <TBody>
                  {crm.slice(0, 8).map((c) => (
                    <TR key={c.lead_id}>
                      <TD>
                        <div className="font-medium">{c.lead_name}</div>
                        <div className="text-label text-text-subtle num">{c.phone}</div>
                      </TD>
                      <TD>
                        <GradeChip grade={c.potential ?? ""} />
                      </TD>
                      <TD>
                        <StatusBadge color={leadStatusDot(c.lead_status)}>
                          {c.lead_status}
                        </StatusBadge>
                      </TD>
                      <TD className="text-right num">{formatBaht(c.budget)}</TD>
                      <TD className="text-right text-small text-text-muted num">
                        {formatThaiDate(c.last_follow_date)}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
