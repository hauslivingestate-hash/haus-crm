import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, History, Banknote } from "lucide-react";
import { Topbar } from "@/components/Topbar";
import { LeadHeader } from "@/components/LeadHeader";
import { LeadTagRow } from "@/components/LeadTagRow";
import { LeadTimeline } from "@/components/LeadTimeline";
import { LeadAdminPanel } from "@/components/LeadAdminPanel";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { StatusBadge, Dot } from "@/components/ui/Dot";
import { Pill } from "@/components/ui/Pill";
import { Avatar } from "@/components/ui/Avatar";
import { GradeChip } from "@/components/ui/GradeChip";
import { getLead } from "@/lib/queries";
import { getAssignableAgents } from "@/lib/lookups";
import { getAssignHistory } from "@/lib/leadHistory";
import { formatBaht, formatDate } from "@/lib/format";
import { leadStatusDot } from "@/lib/status";
import { stageMeta } from "@/lib/pipeline";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) notFound();

  const [agents, assignHistory] = await Promise.all([getAssignableAgents(), getAssignHistory(id)]);
  // sale_id is an employee code; people read names.
  const saleNickname = lead.sale_id
    ? agents.find((a) => a.employeeCode === lead.sale_id)?.nickname ?? lead.sale_id
    : "";

  const stg = stageMeta(lead.pipeline_stage);
  const showClosing =
    lead.lead_status === "Win" || lead.commission != null || lead.closing_date != null;

  return (
    <>
      <Topbar title="Lead" actions={false} />

      <div className="p-4 lg:p-6 space-y-4">
        <Link
          href="/leads"
          className="inline-flex items-center gap-1.5 text-small text-text-muted hover:text-text transition-colors"
        >
          <ArrowLeft size={14} strokeWidth={1.75} /> กลับไป Lead
        </Link>

        {/* Identity header — name/id + contact (phone + LINE) + edit (gated leads.edit) */}
        <LeadHeader lead={lead} />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
          {/* Main column */}
          <div className="flex flex-col gap-4 min-w-0">
            {/* Activity + assignment history — admin uses this as reassign context */}
            <LeadTimeline
              leadId={lead.lead_id}
              sale={lead.sale_id ?? ""}
              dateReceived={lead.date_received}
              agents={agents}
              assignHistory={assignHistory.entries}
            />

            {/* Interested listing (real) */}
            <Card>
              <CardHeader>
                <CardTitle>ทรัพย์ที่สนใจ</CardTitle>
              </CardHeader>
              {lead.listing_code ? (
                <CardContent className="p-0">
                  <Link
                    href={`/listings/${lead.listing_code}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors"
                  >
                    <div className="size-9 rounded-md bg-surface-2 grid place-items-center shrink-0">
                      <Building2 size={16} strokeWidth={1.75} className="text-text-muted" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-body font-medium num">{lead.listing_code}</div>
                      <div className="text-label text-text-subtle">ดูรายละเอียดทรัพย์</div>
                    </div>
                    <ArrowLeft
                      size={14}
                      strokeWidth={1.75}
                      className="ml-auto rotate-180 text-text-subtle"
                    />
                  </Link>
                </CardContent>
              ) : (
                <CardContent>
                  <span className="text-small text-text-subtle">ยังไม่ระบุทรัพย์ที่สนใจ</span>
                </CardContent>
              )}
            </Card>

            {/* Closing (real) — only for won / closed deals */}
            {showClosing && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Banknote size={16} strokeWidth={1.75} className="text-green" />
                    การปิดการขาย
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 text-body">
                  <Row label="คอมมิชชั่น">
                    {lead.commission != null ? (
                      <span className="num font-semibold text-green">{formatBaht(lead.commission)}</span>
                    ) : (
                      <span className="text-text-subtle">—</span>
                    )}
                  </Row>
                  <Row label="วันที่ปิด">
                    <span className="num">{formatDate(lead.closing_date)}</span>
                  </Row>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar (real data) */}
          <div className="flex flex-col gap-4">
            {/* Admin follow-up (recheck + complaint) — only shows for admin/leadership */}
            <LeadAdminPanel
              leadId={lead.lead_id}
              stage={lead.pipeline_stage}
              customerComplain={lead.customer_complain}
              complainStatus={lead.complain_status}
              complainRemark={lead.complain_remark}
            />

            <Card>
              <CardHeader>
                <CardTitle>ข้อมูล Lead</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-body">
                <Row label="ขั้นตอน">
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    <Dot className={stg.dot} />
                    {stg.th}
                  </span>
                </Row>
                <Row label="สถานะ">
                  <StatusBadge color={leadStatusDot(lead.lead_status)}>
                    {lead.lead_status ?? "—"}
                  </StatusBadge>
                </Row>
                <Row label="Potential">
                  {lead.potential ? (
                    <GradeChip grade={lead.potential} />
                  ) : (
                    <span className="text-text-subtle">—</span>
                  )}
                </Row>
                <Row label="งบประมาณ">
                  <span className="num font-semibold">{formatBaht(lead.budget)}</span>
                </Row>
                <Row label="ประเภท">
                  {lead.lead_type ? <Pill>{lead.lead_type}</Pill> : <span className="text-text-subtle">—</span>}
                </Row>
                {/* Group tag — CEO-governed, one per lead. Shares the same store as the
                    leads table, so editing in either place stays in sync. */}
                <Row label="แท็ก">
                  <LeadTagRow leadId={lead.lead_id} tagId={lead.tag_id} />
                </Row>
                <Row label="ผู้ดูแล">
                  {lead.sale_id ? (
                    <span className="inline-flex items-center gap-2">
                      <Avatar name={saleNickname} tone="crimson" className="h-5 w-5" />
                      <span className="text-text-muted">{saleNickname}</span>
                    </span>
                  ) : (
                    <span className="text-text-subtle">—</span>
                  )}
                </Row>
                <Row label="วันที่รับ">
                  <span className="num text-text-muted">{formatDate(lead.date_received)}</span>
                </Row>
                <Row label="ติดตามล่าสุด">
                  <span className="num text-text-muted">{formatDate(lead.last_follow_date)}</span>
                </Row>
              </CardContent>
            </Card>

            {/* Edit history — placeholder */}
            <Card>
              <CardHeader>
                <CardTitle>ประวัติการแก้ไข</CardTitle>
                <Pill>เร็ว ๆ นี้</Pill>
              </CardHeader>
              <CardContent>
                <Empty icon={History}>ยังไม่มีประวัติการแก้ไข</Empty>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-text-subtle">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

function Empty({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
      <Icon size={22} strokeWidth={1.5} className="text-text-subtle" />
      <p className="text-small text-text-subtle">{children}</p>
    </div>
  );
}
