/* Everything a lead's detail view shows. Rendered in two places and only two:

     app/(app)/leads/[id]/page.tsx              → the full page (cold link, refresh, bell)
     app/(app)/leads/@drawer/(.)[id]/page.tsx   → the slide-over (a click from the list)

   It lives here rather than in the page so those two cannot drift. A drawer that is a
   hand-copied subset of a page is a drawer that is missing last month's field, and the
   person who notices is the sale who filled it in and cannot find it again.

   ── THE ORDER OF THE CARDS IS THE POINT ─────────────────────────────────────────
   Top to bottom is most-used to least. จัดการ first, because moving a lead one step down
   the pipeline is the single most frequent thing anyone does here and it used to cost five
   actions. กิจกรรม second, because the note box is where the work gets written down. The
   reference facts — ข้อมูล Lead, ทรัพย์ที่สนใจ — sit below the things you came to do, not
   above them.

   `inDrawer` changes the SHAPE, never the CONTENT. The page has a 320px sidebar beside the
   main column; a drawer does not, so the same cards stack. Nothing is dropped — see
   components/ui/Drawer.tsx for why the drawer is not a summary view. */

import { notFound } from "next/navigation";
import { LeadHeader } from "@/components/LeadHeader";
import { LeadTagRow } from "@/components/LeadTagRow";
import { LeadTimeline } from "@/components/LeadTimeline";
import { LeadManageCard } from "@/components/LeadManageCard";
import { LeadInterestsCard } from "@/components/LeadInterestsCard";
import { LeadAdminPanel } from "@/components/LeadAdminPanel";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Avatar } from "@/components/ui/Avatar";
import { CloseDealCard } from "@/components/CloseDealCard";
import {
  getLead,
  getLeadTimeline,
  getActionTypes,
  getLeadInterests,
} from "@/lib/queries";
import { getAssignableAgents } from "@/lib/lookups";
import { assignEntries } from "@/lib/leadHistory";
import { formatBaht, formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";

export async function LeadDetail({ id, inDrawer = false }: { id: string; inDrawer?: boolean }) {
  /* ONE layer of round trips, and nothing waits on anything else.
     Each Supabase round trip from the office measures ~0.4s, so a query that waits on an
     answer it never reads costs a fifth of a second for nothing. This was seven calls: six
     in parallel, then the deal's listing, which keys off `listing_code` and so could not be
     fired until the lead came back. The listing now rides along inside getLead() through the
     foreign key, and the reassignment history is derived from the audit rows the timeline
     already fetched rather than querying audit_log a second time (lib/leadHistory.ts). */
  const [lead, agents, timeline, actionTypes, interests] = await Promise.all([
    getLead(id),
    getAssignableAgents(),
    getLeadTimeline(id),
    getActionTypes(),
    getLeadInterests(id),
  ]);
  if (!lead) notFound();

  const listingCtx = lead.deal_listing;
  const assignHistory = assignEntries(timeline.audits);

  // sale_id is an employee code; people read names.
  const saleNickname = lead.sale_id
    ? agents.find((a) => a.employeeCode === lead.sale_id)?.nickname ?? lead.sale_id
    : "";

  // Only actions that mean something on a customer — the table's own `attach` column
  // decides, so adding one in Settings puts it here without a code change.
  const leadActions = actionTypes
    .filter((a) => a.attach === "lead" || a.attach === "either")
    .map((a) => a.name);

  return (
    <div className={cn("space-y-4", inDrawer ? "p-4 lg:p-5" : "p-4 lg:p-6")}>
      {/* Identity header — name/id + contact (phone + LINE) + edit (gated leads.edit).
          The right padding in the drawer keeps the name and the edit button clear of the
          floating ✕ that sits over this corner (components/ui/Drawer.tsx). */}
      <div className={cn(inDrawer && "pr-11")}>
        <LeadHeader lead={lead} />
      </div>

      <div
        className={cn(
          "grid grid-cols-1 gap-4 items-start",
          !inDrawer && "lg:grid-cols-[1fr_320px]"
        )}
      >
        {/* Main column */}
        <div className="flex flex-col gap-4 min-w-0">
          {/* One tap per field. The most-used control on the screen, so it goes first. */}
          <LeadManageCard
            leadId={lead.lead_id}
            stage={lead.pipeline_stage}
            status={lead.lead_status}
            potential={lead.potential}
          />

          {/* Real activity + the box that writes it, then the audit trail for admins. */}
          <LeadTimeline
            leadId={lead.lead_id}
            sale={lead.sale_id ?? ""}
            stage={lead.pipeline_stage}
            dateReceived={lead.date_received}
            agents={agents}
            assignHistory={assignHistory}
            activities={timeline.activities}
            audits={timeline.audits}
            auditReadable={timeline.auditReadable}
            actionTypes={leadActions}
          />

          {/* Closing — the only place the company's revenue is entered. Decides for
              itself whether to show: a closed deal always renders, an open lead renders
              only the button that starts one (lib/deals.ts `isClosed`). */}
          <CloseDealCard
            leadId={lead.lead_id}
            closingPrice={lead.closing_price}
            closingDate={lead.closing_date}
            transferDate={lead.transfer_date}
            commission={lead.commission}
            remark={lead.case_closing_remark}
            pipelineStage={lead.pipeline_stage}
            listingCode={lead.listing_code}
            askingPrice={listingCtx?.asking_price ?? null}
            listingStatus={listingCtx?.listing_status ?? null}
            lastMatch={lead.last_match?.[0] ?? null}
          />

          {/* ทรัพย์ที่สนใจ — many per lead, editable here. Was a read-only link to the
              one listing recorded at intake, with no way to add another. */}
          <LeadInterestsCard
            leadId={lead.lead_id}
            interests={interests}
            dealListing={lead.listing_code}
          />
        </div>

        {/* Sidebar (real data) — stacks under the main column inside the drawer. */}
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
            {/* Stage, status and grade are NOT repeated here — they live in จัดการ above,
                where they can be changed. Two places showing one value is how a screen
                starts disagreeing with itself. */}
            <CardContent className="flex flex-col gap-3 text-body">
              <Row label="งบประมาณ">
                <span className="num font-semibold">{formatBaht(lead.budget)}</span>
              </Row>
              <Row label="ประเภท">
                {lead.lead_type ? (
                  <Pill>{lead.lead_type}</Pill>
                ) : (
                  <span className="text-text-subtle">—</span>
                )}
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
        </div>
      </div>
    </div>
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
