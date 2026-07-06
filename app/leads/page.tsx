import { Topbar } from "@/components/Topbar";
import { Card, CardContent } from "@/components/ui/Card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { StatusBadge } from "@/components/ui/Dot";
import { GradeChip } from "@/components/ui/GradeChip";
import { Avatar } from "@/components/ui/Avatar";
import { Pill } from "@/components/ui/Pill";
import { stageMeta } from "@/lib/pipeline";
import { getCrm } from "@/lib/queries";
import { formatBaht, formatThaiDate } from "@/lib/format";
import { leadStatusDot } from "@/lib/status";
import { Dot } from "@/components/ui/Dot";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const crm = await getCrm();

  return (
    <>
      <Topbar title="Lead" subtitle={`CRM ฝั่งผู้ซื้อ · ${crm.length} รายการ`} />
      <div className="p-6">
        <Card>
          <CardContent className="p-0">
            <Table>
              <THead>
                <TR>
                  <TH>Lead ID</TH>
                  <TH>ลูกค้า</TH>
                  <TH>เกรด</TH>
                  <TH>สเตจ</TH>
                  <TH>สถานะ</TH>
                  <TH>ประเภท</TH>
                  <TH>เซล</TH>
                  <TH className="text-right">งบประมาณ</TH>
                  <TH className="text-right">คอมมิชชั่น</TH>
                  <TH className="text-right">ติดตามล่าสุด</TH>
                </TR>
              </THead>
              <TBody>
                {crm.map((c) => {
                  const stage = stageMeta(c.pipeline_stage);
                  return (
                    <TR key={c.lead_id}>
                      <TD className="num text-small text-text-muted">{c.lead_id}</TD>
                      <TD>
                        <div className="font-medium">{c.lead_name}</div>
                        <div className="text-label text-text-subtle num">{c.phone}</div>
                      </TD>
                      <TD>
                        <GradeChip grade={c.potential ?? ""} />
                      </TD>
                      <TD>
                        <span className="inline-flex items-center gap-1.5 text-body whitespace-nowrap">
                          <Dot className={stage.dot} />
                          {stage.th}
                        </span>
                      </TD>
                      <TD>
                        <StatusBadge color={leadStatusDot(c.lead_status)}>
                          {c.lead_status}
                        </StatusBadge>
                      </TD>
                      <TD>
                        <Pill>{c.lead_type ?? "—"}</Pill>
                      </TD>
                      <TD>
                        <span className="inline-flex items-center gap-1.5">
                          <Avatar name={c.sale_id ?? ""} tone="crimson" className="h-5 w-5" />
                          <span className="text-small num text-text-muted">{c.sale_id}</span>
                        </span>
                      </TD>
                      <TD className="text-right num">{formatBaht(c.budget)}</TD>
                      <TD className="text-right num text-green">
                        {c.commission ? formatBaht(c.commission) : "—"}
                      </TD>
                      <TD className="text-right text-small text-text-muted num">
                        {formatThaiDate(c.last_follow_date)}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
