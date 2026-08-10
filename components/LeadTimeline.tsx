"use client";

import * as React from "react";
import { UserPlus, Phone, Repeat, CalendarCheck, StickyNote, ArrowRight, Share2, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { useRbac } from "@/components/RbacProvider";
import { assignLead } from "@/lib/mutations/leads";
import type { AgentOption } from "@/components/LeadForm";
import type { AssignHistoryEntry } from "@/lib/leadHistory";
import { sampleTimeline, type TimelineEvent, type TimelineKind } from "@/lib/leadTimeline";
import { formatDate } from "@/lib/format";
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
  agents,
  assignHistory,
}: {
  leadId: string;
  /** employee_code of the assigned agent, "" when unassigned. */
  sale: string;
  dateReceived: string | null;
  agents: AgentOption[];
  assignHistory: AssignHistoryEntry[];
}) {
  const router = useRouter();
  const { can } = useRbac();
  const canReassign = can("leads.assign");
  const [current, setCurrent] = React.useState(sale);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => setCurrent(sale), [sale]);

  const nicknameOf = React.useCallback(
    (code: string | null) => (code ? agents.find((a) => a.employeeCode === code)?.nickname ?? code : "ยังไม่มอบหมาย"),
    [agents]
  );

  async function onAssign(next: string) {
    const prev = current;
    setError(null);
    setCurrent(next);
    const result = await assignLead(leadId, next);
    if (!result.ok) {
      setCurrent(prev);
      setError(result.error);
    }
    router.refresh();
  }

  const events: TimelineEvent[] = React.useMemo(() => {
    // Still sample activity (real activities land in Phase 6) — but feed it the agent's NAME,
    // since `sale` is an employee code and it renders straight into the "by" line.
    const activity = sampleTimeline(leadId, nicknameOf(sale), dateReceived);
    // Real reassignments out of audit_log — these survive a refresh, unlike the in-memory
    // trail this replaced.
    const audits: TimelineEvent[] = assignHistory.map((e, i) => ({
      id: `${leadId}-assign-${i}`,
      kind: "assign",
      at: e.at.slice(0, 10),
      by: nicknameOf(e.by),
      text: e.from
        ? `มอบหมายใหม่: ${nicknameOf(e.from)} → ${nicknameOf(e.to)}`
        : `มอบหมายให้ ${nicknameOf(e.to)}`,
    }));
    return [...activity, ...audits].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  }, [leadId, sale, dateReceived, assignHistory, nicknameOf]);

  const effective = current;

  return (
    <Card>
      <CardHeader>
        <CardTitle>กิจกรรม & ประวัติ</CardTitle>
        {canReassign ? (
          <div className="flex items-center gap-1.5">
            <span className="text-label text-text-subtle">มอบหมาย:</span>
            <select
              value={effective}
              onChange={(e) => onAssign(e.target.value)}
              className="h-7 px-2 rounded-md border border-border-strong bg-surface text-small focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <option value="">— ยังไม่มอบหมาย —</option>
              {/* Values are employee codes; keep an unknown one (someone who left) selectable. */}
              {effective && !agents.some((a) => a.employeeCode === effective) && (
                <option value={effective}>{effective}</option>
              )}
              {agents.map((a) => (
                <option key={a.employeeCode} value={a.employeeCode}>{a.nickname}</option>
              ))}
            </select>
            {error && (
              <span className="text-label text-red shrink-0" title={error}>
                มอบหมายไม่สำเร็จ
              </span>
            )}
          </div>
        ) : (
          effective && (
            <span className="inline-flex items-center gap-1.5 text-small text-text-muted">
              <Avatar name={nicknameOf(effective)} tone="crimson" className="h-5 w-5" /> {nicknameOf(effective)}
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
                  <div className="text-label text-text-subtle mt-0.5 num">{e.by} · {formatDate(e.at)}</div>
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
