"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Phone, Check, Clock, AlertCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Dot } from "@/components/ui/Dot";
import { useRbac } from "@/components/RbacProvider";
import { setLeadComplaint } from "@/lib/mutations/leads";
import { COMPLAINT_STATUSES, isContacted } from "@/lib/leads";
import { stageMeta } from "@/lib/pipeline";
import { cn } from "@/lib/cn";

const fieldCls =
  "w-full h-9 px-3 rounded-md border border-border-strong bg-surface text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

interface Props {
  leadId: string;
  stage: string | null;
  customerComplain: string | null;
  complainStatus: string | null;
  complainRemark: string | null;
}

// Admin follow-up panel — the process after intake+assign: recheck that the assigned sale
// actually contacted the customer (derived, read-only), and log/track complaints (real
// write, main_6_buyer_crm.customer_complain/complain_status/complain_remark). Mirrors the
// Lead Submission sheet's Recheck / Customer Complain columns. Gated to leads.assign.
export function LeadAdminPanel({ leadId, stage, customerComplain, complainStatus, complainRemark }: Props) {
  const router = useRouter();
  const { can } = useRbac();

  const [hasComplaint, setHasComplaint] = React.useState(!!complainStatus);
  const [text, setText] = React.useState(customerComplain ?? "");
  const [status, setStatus] = React.useState(complainStatus ?? COMPLAINT_STATUSES[0]);
  const [remark, setRemark] = React.useState(complainRemark ?? "");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  React.useEffect(() => {
    setHasComplaint(!!complainStatus);
    setText(customerComplain ?? "");
    setStatus(complainStatus ?? COMPLAINT_STATUSES[0]);
    setRemark(complainRemark ?? "");
    setDone(false);
    setError(null);
  }, [customerComplain, complainStatus, complainRemark]);

  if (!can("leads.assign")) return null;

  // Contacted is DERIVED from the pipeline stage — the sale advancing Lead→Call is the contact.
  const contacted = isContacted(stage);
  const stg = stageMeta(stage);

  const dirty =
    hasComplaint !== !!complainStatus ||
    text !== (customerComplain ?? "") ||
    status !== (complainStatus ?? COMPLAINT_STATUSES[0]) ||
    remark !== (complainRemark ?? "");

  async function save() {
    setBusy(true);
    setError(null);
    const result = await setLeadComplaint(leadId, {
      customerComplain: hasComplaint ? text : null,
      complainStatus: hasComplaint ? status : null,
      complainRemark: hasComplaint ? remark : null,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDone(true);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="inline-flex items-center gap-1.5">
          <Phone size={15} strokeWidth={1.75} className="text-accent" /> ติดตามโดยแอดมิน
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Recheck (derived from stage, read-only): did the assigned sale contact the customer? */}
        <div>
          <div className="text-small text-text-muted mb-1.5">เซลติดต่อลูกค้าแล้วหรือยัง</div>
          <div
            className={cn(
              "flex items-center gap-2 rounded-md border px-3 h-9",
              contacted ? "border-green/40 bg-green-bg" : "border-amber/40 bg-amber-bg"
            )}
          >
            {contacted ? (
              <span className="inline-flex items-center gap-1.5 text-small font-medium text-green">
                <Check size={14} strokeWidth={2.5} /> ติดต่อแล้ว
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-small font-medium text-amber">
                <Clock size={14} strokeWidth={2} /> ยังไม่ติดต่อ
              </span>
            )}
            <span className="ml-auto inline-flex items-center gap-1.5 text-label text-text-subtle whitespace-nowrap">
              <Dot className={stg.dot} /> {stg.label}
            </span>
          </div>
          <div className="text-label text-text-subtle mt-1">อัตโนมัติจากสเตจไปป์ไลน์ (เซลขยับ Lead → Call = ติดต่อแล้ว)</div>
        </div>

        {/* Complaint tracking */}
        <div>
          <button
            onClick={() => setHasComplaint((v) => !v)}
            className="flex items-center justify-between w-full text-small mb-1.5"
          >
            <span className="text-text-muted">มีข้อร้องเรียน</span>
            <span
              className={cn(
                "relative inline-flex h-5 w-9 rounded-full transition-colors",
                hasComplaint ? "bg-red" : "bg-surface-2 border border-border-strong"
              )}
            >
              <span className={cn("absolute top-0.5 size-4 rounded-full bg-surface shadow-card transition-all", hasComplaint ? "left-4" : "left-0.5")} />
            </span>
          </button>
          {hasComplaint && (
            <div className="flex flex-col gap-2 mt-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={2}
                placeholder="ลูกค้าร้องเรียนเรื่องอะไร…"
                className={cn(fieldCls, "h-auto py-2 resize-none")}
              />
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={fieldCls}>
                {COMPLAINT_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <textarea
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                rows={2}
                placeholder="หมายเหตุการแก้ไข…"
                className={cn(fieldCls, "h-auto py-2 resize-none")}
              />
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-md px-3 py-2 text-small border bg-red-bg text-red border-red/30 inline-flex items-start gap-1.5">
            <AlertCircle size={14} strokeWidth={2} className="mt-0.5 shrink-0" /> {error}
          </div>
        )}
        {done && !dirty && (
          <div className="rounded-md px-3 py-2 text-small border bg-green-bg text-green border-green/30 inline-flex items-center gap-1.5">
            <Check size={14} strokeWidth={2} /> บันทึกแล้ว
          </div>
        )}
        <button
          onClick={save}
          disabled={busy || !dirty}
          className="h-9 rounded-md bg-accent text-text-onaccent font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:pointer-events-none"
        >
          {busy ? "กำลังบันทึก…" : "บันทึก"}
        </button>
      </CardContent>
    </Card>
  );
}
