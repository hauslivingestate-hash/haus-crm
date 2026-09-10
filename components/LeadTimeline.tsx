"use client";

import * as React from "react";
import { UserPlus, Phone, Repeat, CalendarCheck, StickyNote, ArrowRight, Share2, LoaderCircle, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { useRbac } from "@/components/RbacProvider";
import { useMasterData } from "@/components/MasterDataProvider";
import { assignLead } from "@/lib/mutations/leads";
import { logLeadActivity } from "@/lib/mutations/activity";
import type { AgentOption } from "@/components/LeadForm";
import type { AssignHistoryEntry } from "@/lib/leadHistory";
import {
  buildTimeline,
  type LeadActivityRow,
  type LeadAuditRow,
  type TimelineEvent,
  type TimelineKind,
} from "@/lib/leadTimeline";
import { stageMeta } from "@/lib/pipeline";
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

/* กิจกรรม & ประวัติ — what has actually happened to this lead, and the box that adds to it.
 *
 * The log used to be invented (see lib/leadTimeline.ts). It is now the real `activities`
 * rows for this lead, merged with the audit trail for whoever may read it. Most leads will
 * show only "รับลีดเข้าระบบ" to begin with, because until the composer below shipped there
 * was no way in the product to record anything against a lead at all. That emptiness is the
 * true state, and it fills in from the first follow-up someone logs.
 *
 * THE COMPOSER IS THE POINT. A read-only history is a report; this is the place the work
 * gets written down, which is why it sits at the top of the card rather than under the log. */
export function LeadTimeline({
  leadId,
  sale,
  stage,
  dateReceived,
  agents,
  assignHistory,
  activities,
  audits,
  auditReadable,
  actionTypes,
}: {
  leadId: string;
  /** employee_code of the assigned agent, "" when unassigned. */
  sale: string;
  /** Current pipeline_stage — decides whether the composer offers to move it. */
  stage: string | null;
  dateReceived: string | null;
  agents: AgentOption[];
  assignHistory: AssignHistoryEntry[];
  activities: LeadActivityRow[];
  audits: LeadAuditRow[];
  /** false = the viewer may not read audit_log, so edits are hidden rather than absent. */
  auditReadable: boolean;
  /** Lead-attachable actions from `action_type`, in the company's own order. */
  actionTypes: string[];
}) {
  const router = useRouter();
  const { can } = useRbac();
  const canReassign = can("leads.assign");
  const canLog = can("activity.log") || can("roles.manage");
  const [current, setCurrent] = React.useState(sale);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => setCurrent(sale), [sale]);

  const nicknameOf = React.useCallback(
    (code: string | null) =>
      code ? agents.find((a) => a.employeeCode === code)?.nickname ?? code : "ยังไม่มอบหมาย",
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
    // Reassignments are built here rather than in buildTimeline: they are the one event
    // whose text needs the agent directory to read as anything but employee codes.
    const assigns: TimelineEvent[] = assignHistory.map((e, i) => ({
      id: `${leadId}-assign-${i}`,
      kind: "assign",
      at: e.at.slice(0, 10),
      by: e.by,
      text: e.from
        ? `มอบหมายใหม่: ${nicknameOf(e.from)} → ${nicknameOf(e.to)}`
        : `มอบหมายให้ ${nicknameOf(e.to)}`,
    }));
    return buildTimeline({ leadId, dateReceived, activities, audits, extra: assigns });
  }, [leadId, dateReceived, activities, audits, assignHistory, nicknameOf]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>กิจกรรม &amp; ประวัติ</CardTitle>
        {canReassign ? (
          <div className="flex items-center gap-1.5">
            <span className="text-label text-text-subtle">มอบหมาย:</span>
            <select
              value={current}
              onChange={(e) => onAssign(e.target.value)}
              className="h-7 px-2 rounded-md border border-border-strong bg-surface text-small focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <option value="">— ยังไม่มอบหมาย —</option>
              {/* Values are employee codes; keep an unknown one (someone who left) selectable. */}
              {current && !agents.some((a) => a.employeeCode === current) && (
                <option value={current}>{current}</option>
              )}
              {agents.map((a) => (
                <option key={a.employeeCode} value={a.employeeCode}>
                  {a.nickname}
                </option>
              ))}
            </select>
            {error && (
              <span className="text-label text-red shrink-0" title={error}>
                มอบหมายไม่สำเร็จ
              </span>
            )}
          </div>
        ) : (
          current && (
            <span className="inline-flex items-center gap-1.5 text-small text-text-muted">
              <Avatar name={nicknameOf(current)} tone="crimson" className="h-5 w-5" />{" "}
              {nicknameOf(current)}
            </span>
          )
        )}
      </CardHeader>

      {canLog && actionTypes.length > 0 && (
        <Composer
          leadId={leadId}
          actionTypes={actionTypes}
          stage={stage}
          onDone={() => router.refresh()}
        />
      )}

      <CardContent className="p-0">
        <ol className="divide-y divide-border">
          {events.map((e) => {
            const Icon = KIND_ICON[e.kind];
            return (
              <li key={e.id} className="flex items-start gap-3 px-4 py-3">
                <span
                  className={cn(
                    "size-8 rounded-md grid place-items-center shrink-0",
                    KIND_TONE[e.kind]
                  )}
                >
                  <Icon size={15} strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-body">
                    {e.text}
                    {e.count && <span className="num text-text-muted"> × {e.count}</span>}
                  </p>
                  <p className="text-label text-text-subtle">
                    <span className="num">{formatDate(e.at)}</span>
                    {e.by && <> · {nicknameOf(e.by)}</>}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>

        {/* Two different silences, said differently. */}
        {events.length === 0 && (
          <p className="px-4 py-6 text-center text-small text-text-subtle">
            ยังไม่มีการบันทึกกิจกรรม
          </p>
        )}
        {!auditReadable && (
          <p className="border-t border-border px-4 py-2 text-label text-text-subtle">
            แสดงเฉพาะกิจกรรม — ประวัติการแก้ไขและการมอบหมายต้องมีสิทธิ์ผู้ดูแลระบบ
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/* บันทึกการติดตาม — the write. Deliberately three controls and no more: what you did,
   what happened, when. A form that asks for more is a form people skip on a busy day, and
   an unlogged call is worth less than a badly logged one. */
function Composer({
  leadId,
  actionTypes,
  stage,
  onDone,
}: {
  leadId: string;
  actionTypes: string[];
  stage: string | null;
  onDone: () => void;
}) {
  const [action, setAction] = React.useState(actionTypes[0] ?? "");
  const [note, setNote] = React.useState("");
  const [date, setDate] = React.useState("");
  /* "" = leave the stage alone, and that is always the default.
     It used to be a checkbox, pre-ticked, offering the stage whose name matched the action
     — so it appeared for Show and vanished for บันทึก, with no rule on screen (Ben:
     "shouldn't it apply on all the stages?"). This offers every stage, every time, and
     picks nothing for you. */
  const [moveTo, setMoveTo] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [moved, setMoved] = React.useState<string | null>(null);
  // The governed pipeline, in its stored order — the same list the server will check.
  const { pipelineStages } = useMasterData();

  async function save() {
    setBusy(true);
    setError(null);
    setMoved(null);
    const res = await logLeadActivity(leadId, { action, note, date, count: 1, moveToStage: moveTo });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setNote("");
    setDate("");
    setMoveTo("");
    if (res.movedTo) setMoved(stageMeta(res.movedTo).label);
    onDone();
  }

  return (
    <div className="border-b border-border px-4 py-3 flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-1">
        {actionTypes.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAction(a)}
            aria-pressed={a === action}
            className={cn(
              "rounded-full px-2.5 py-1 text-label font-medium transition-colors",
              a === action
                ? "bg-accent text-text-onaccent"
                : "bg-surface-2 text-text-muted hover:bg-surface-3 hover:text-text"
            )}
          >
            {a}
          </button>
        ))}
      </div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="บันทึกการติดตามวันนี้…"
        className="w-full resize-y rounded-md border border-border-strong bg-surface px-3 py-2 text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      />

      <div className="flex flex-wrap items-center gap-2">
        {/* Blank means today. Shown rather than hidden because writing up Friday what
            happened on Tuesday is normal, and back-dating it keeps the KPI honest. */}
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="วันที่ทำกิจกรรม (เว้นว่าง = วันนี้)"
          className="h-8 rounded-md border border-border-strong bg-surface px-2 text-small num focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        />
        {/* Every stage, always here, nothing preselected. The lead's current stage is
            marked so it is obvious that picking it changes nothing. */}
        <select
          value={moveTo}
          onChange={(e) => setMoveTo(e.target.value)}
          aria-label="ย้ายขั้นตอน"
          className="h-8 rounded-md border border-border-strong bg-surface px-2 text-small focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <option value="">— ไม่เปลี่ยนขั้นตอน —</option>
          {pipelineStages.map((s) => (
            <option key={s.id} value={s.id}>
              ย้ายไป {stageMeta(s.id).label}
              {s.id === stage ? " (ปัจจุบัน)" : ""}
            </option>
          ))}
        </select>
        <Button size="sm" onClick={save} disabled={busy || !action}>
          {busy && <LoaderCircle size={13} className="animate-spin" />}
          บันทึก
        </Button>
        {error && <span className="text-label text-red">{error}</span>}
        {moved && (
          <span className="inline-flex items-center gap-1 text-label text-green">
            <Check size={12} strokeWidth={2} /> ย้ายไป {moved} แล้ว
          </span>
        )}
      </div>
    </div>
  );
}
