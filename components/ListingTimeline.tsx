"use client";

/* กิจกรรม & ประวัติ (ทรัพย์) — one card where there used to be two.
 *
 * The listing page carried กิจกรรมล่าสุด (real, read-only) and ประวัติการแก้ไข (a "เร็ว ๆ นี้"
 * placeholder wired to nothing). Ben, 2026-09-10: they are the same thing. Both answer
 * "what has happened to this listing?" — one from the activity log, one from the audit
 * trail — and splitting them meant reading two cards to get one story, with half of it
 * permanently empty.
 *
 * Merged here, and given the note box the listing side never had: the only way to record
 * an owner conversation used to be `activity_comment`, a single text field that each new
 * conversation overwrote. */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  UserPlus, Phone, Repeat, CalendarCheck, StickyNote, ArrowRight, Share2, LoaderCircle, Check,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useRbac } from "@/components/RbacProvider";
import { useMasterData } from "@/components/MasterDataProvider";
import { logListingActivity } from "@/lib/mutations/activity";
import {
  buildTimeline,
  type LeadActivityRow,
  type LeadAuditRow,
  type TimelineEvent,
  type TimelineKind,
} from "@/lib/leadTimeline";
import { ownerStageMeta } from "@/lib/ownerPipeline";
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

export function ListingTimeline({
  listingId,
  dateCreated,
  activities,
  audits,
  auditReadable,
  actionTypes,
  ownerStage,
  nicknameOf,
}: {
  listingId: string;
  dateCreated: string | null;
  activities: LeadActivityRow[];
  audits: LeadAuditRow[];
  auditReadable: boolean;
  /** Listing-attachable actions from `action_type`, in the company's own order. */
  actionTypes: string[];
  ownerStage: string | null;
  /** employee_code → display name, resolved by the server. */
  nicknameOf: Record<string, string>;
}) {
  const router = useRouter();
  const { can } = useRbac();
  const canLog = can("activity.log") || can("roles.manage");

  const name = React.useCallback(
    (code: string) => nicknameOf[code] ?? code,
    [nicknameOf]
  );

  const events: TimelineEvent[] = React.useMemo(
    () =>
      buildTimeline({
        leadId: listingId,
        dateReceived: dateCreated,
        activities,
        audits,
      }).map((e) =>
        // buildTimeline's anchor text is written for a lead.
        e.kind === "created" ? { ...e, text: "เพิ่มทรัพย์เข้าระบบ" } : e
      ),
    [listingId, dateCreated, activities, audits]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>กิจกรรม &amp; ประวัติ</CardTitle>
      </CardHeader>

      {canLog && actionTypes.length > 0 && (
        <Composer
          listingId={listingId}
          actionTypes={actionTypes}
          ownerStage={ownerStage}
          onDone={() => router.refresh()}
        />
      )}

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
                  <p className="text-body">
                    {e.text}
                    {e.count && <span className="num text-text-muted"> × {e.count}</span>}
                  </p>
                  <p className="text-label text-text-subtle">
                    <span className="num">{formatDate(e.at)}</span>
                    {e.by && <> · {name(e.by)}</>}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>

        {events.length === 0 && (
          <p className="px-4 py-6 text-center text-small text-text-subtle">ยังไม่มีการบันทึกกิจกรรม</p>
        )}
        {!auditReadable && (
          <p className="border-t border-border px-4 py-2 text-label text-text-subtle">
            แสดงเฉพาะกิจกรรม — ประวัติการแก้ไขต้องมีสิทธิ์ผู้ดูแลระบบ
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Composer({
  listingId,
  actionTypes,
  ownerStage,
  onDone,
}: {
  listingId: string;
  actionTypes: string[];
  ownerStage: string | null;
  onDone: () => void;
}) {
  const [action, setAction] = React.useState(actionTypes[0] ?? "");
  const [note, setNote] = React.useState("");
  const [date, setDate] = React.useState("");
  // "" = leave the stage alone, always the default. See the lead composer for why this is
  // an explicit list rather than a checkbox that guessed from the action name.
  const [moveTo, setMoveTo] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [moved, setMoved] = React.useState<string | null>(null);
  const { ownerStages } = useMasterData();

  async function save() {
    setBusy(true);
    setError(null);
    setMoved(null);
    const res = await logListingActivity(listingId, {
      action, note, date, count: 1, moveToStage: moveTo,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setNote("");
    setDate("");
    setMoveTo("");
    if (res.movedTo) setMoved(ownerStageMeta(res.movedTo).label);
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
        placeholder="บันทึกการคุยกับเจ้าของ…"
        className="w-full resize-y rounded-md border border-border-strong bg-surface px-3 py-2 text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      />

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="วันที่ทำกิจกรรม (เว้นว่าง = วันนี้)"
          className="h-8 rounded-md border border-border-strong bg-surface px-2 text-small num focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        />
        <select
          value={moveTo}
          onChange={(e) => setMoveTo(e.target.value)}
          aria-label="ย้ายไปป์ไลน์เจ้าของ"
          className="h-8 rounded-md border border-border-strong bg-surface px-2 text-small focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <option value="">— ไม่เปลี่ยนขั้นตอน —</option>
          {ownerStages.map((s) => (
            <option key={s.id} value={s.id}>
              ย้ายไป {ownerStageMeta(s.id).label}
              {s.id === ownerStage ? " (ปัจจุบัน)" : ""}
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
