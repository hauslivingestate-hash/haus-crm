"use client";

import * as React from "react";
import { UserPlus, Phone, Repeat, CalendarCheck, StickyNote, ArrowRight, Share2, Check } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { useNewLeads } from "@/components/NewLeadsProvider";
import { useRbac } from "@/components/RbacProvider";
import { assignableAgents, defaultAssignee } from "@/lib/leads";
import { sampleTimeline, type TimelineEvent, type TimelineKind } from "@/lib/leadTimeline";
import { formatThaiDate } from "@/lib/format";
import { cn } from "@/lib/cn";

const KIND_ICON: Record<TimelineKind, React.ElementType> = {
  created: UserPlus,
  call: Phone,
  follow: Repeat,
  show: CalendarCheck,
  note: StickyNote,
  stage: ArrowRight,
  assign: Share2,
};
const KIND_TONE: Record<TimelineKind, string> = {
  created: "bg-accent-wash text-accent",
  call: "bg-blue-bg text-blue",
  follow: "bg-amber-bg text-amber",
  show: "bg-violet-bg text-violet",
  note: "bg-surface-2 text-text-muted",
  stage: "bg-green-bg text-green",
  assign: "bg-accent-wash text-accent",
};

// Lead activity + assignment history, so admin can see what the sales logged before
// reassigning. Sample activity (lib/leadTimeline) merged with live reassign audit from the
// provider. A gated reassign control writes an audit event that shows up here immediately.
export function LeadTimeline({
  leadId,
  sale,
  dateReceived,
  listingCode,
}: {
  leadId: string;
  sale: string;
  dateReceived: string | null;
  listingCode: string | null;
}) {
  const { historyOf, assignments, assign } = useNewLeads();
  const { can, currentUser } = useRbac();
  const canReassign = can("leads.assign");
  const agents = assignableAgents();

  const effective = assignments[leadId] ?? sale;
  const reassigns = historyOf(leadId);

  const events: TimelineEvent[] = React.useMemo(() => {
    const activity = sampleTimeline(leadId, sale, dateReceived);
    const audits: TimelineEvent[] = reassigns.map((e, i) => ({
      id: `${leadId}-assign-${i}`,
      kind: "assign",
      at: e.at.slice(0, 10),
      by: e.by,
      text: e.from ? `มอบหมายใหม่: ${e.from} → ${e.to}` : `มอบหมายให้ ${e.to}`,
    }));
    return [...activity, ...audits].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  }, [leadId, sale, dateReceived, reassigns]);

  const isOwnerSale = !!listingCode && effective === defaultAssignee(listingCode) && !!effective;

  return (
    <Card>
      <CardHeader>
        <CardTitle>กิจกรรม & ประวัติ</CardTitle>
        {canReassign ? (
          <div className="flex items-center gap-1.5">
            <span className="text-label text-text-subtle">มอบหมาย:</span>
            <select
              value={effective}
              onChange={(e) => assign(leadId, e.target.value, currentUser.name, effective)}
              className="h-7 px-2 rounded-md border border-border-strong bg-surface text-small focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <option value="">— ยังไม่มอบหมาย —</option>
              {effective && !agents.some((a) => a.nickname === effective) && <option value={effective}>{effective}</option>}
              {agents.map((a) => (
                <option key={a.id} value={a.nickname}>{a.nickname}</option>
              ))}
            </select>
            {isOwnerSale && (
              <span className="text-label text-green inline-flex items-center gap-0.5 shrink-0" title="เจ้าของทรัพย์ที่ลูกค้าสนใจ">
                <Check size={12} strokeWidth={2.5} /> เจ้าของ
              </span>
            )}
          </div>
        ) : (
          effective && (
            <span className="inline-flex items-center gap-1.5 text-small text-text-muted">
              <Avatar name={effective} tone="crimson" className="h-5 w-5" /> {effective}
            </span>
          )
        )}
      </CardHeader>
      <CardContent className="p-0">
        <ol className="divide-y divide-border">
          {events.map((e) => {
            const Icon = KIND_ICON[e.kind];
            return (
              <li key={e.id} className="flex items-start gap-3 px-4 py-3">
                <span className={cn("size-8 rounded-md grid place-items-center shrink-0", KIND_TONE[e.kind])}>
                  <Icon size={15} strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-body">{e.text}</div>
                  <div className="text-label text-text-subtle mt-0.5 num">{e.by} · {formatThaiDate(e.at)}</div>
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
