"use client";

import * as React from "react";
import { Phone, Check, Clock } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Dot } from "@/components/ui/Dot";
import { useNewLeads } from "@/components/NewLeadsProvider";
import { useRbac } from "@/components/RbacProvider";
import { COMPLAINT_STATUSES, isContacted } from "@/lib/leads";
import { stageMeta } from "@/lib/pipeline";
import { cn } from "@/lib/cn";

const fieldCls =
  "w-full h-9 px-3 rounded-md border border-border-strong bg-surface text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

// Admin follow-up panel — the process after intake+assign: recheck that the assigned sale
// actually contacted the customer, and log/track complaints. Mirrors the Lead Submission
// sheet's Recheck / Customer Complain columns. Gated to leads.assign (admin/leadership).
export function LeadAdminPanel({ leadId, stage }: { leadId: string; stage: string | null }) {
  const { processOf, setProcess } = useNewLeads();
  const { can, currentUser } = useRbac();

  if (!can("leads.assign")) return null;
  const p = processOf(leadId);
  const upd = (patch: Parameters<typeof setProcess>[1]) => setProcess(leadId, patch, currentUser.name);

  // Contacted is DERIVED from the pipeline stage — the sale advancing Lead→Call is the contact.
  const contacted = isContacted(stage);
  const stg = stageMeta(stage);

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
              <Dot className={stg.dot} /> {stg.th}
            </span>
          </div>
          <div className="text-label text-text-subtle mt-1">อัตโนมัติจากสเตจไปป์ไลน์ (เซลขยับ Lead → Call = ติดต่อแล้ว)</div>
        </div>

        {/* Complaint tracking */}
        <div>
          <button
            onClick={() => upd({ complaint: !p.complaint })}
            className="flex items-center justify-between w-full text-small mb-1.5"
          >
            <span className="text-text-muted">มีข้อร้องเรียน</span>
            <span
              className={cn(
                "relative inline-flex h-5 w-9 rounded-full transition-colors",
                p.complaint ? "bg-red" : "bg-surface-2 border border-border-strong"
              )}
            >
              <span className={cn("absolute top-0.5 size-4 rounded-full bg-surface shadow-card transition-all", p.complaint ? "left-4" : "left-0.5")} />
            </span>
          </button>
          {p.complaint && (
            <div className="flex flex-col gap-2 mt-2">
              <select
                value={p.complaintStatus ?? "เปิด"}
                onChange={(e) => upd({ complaintStatus: e.target.value })}
                className={fieldCls}
              >
                {COMPLAINT_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <textarea
                value={p.complaintRemark ?? ""}
                onChange={(e) => upd({ complaintRemark: e.target.value })}
                rows={2}
                placeholder="รายละเอียดข้อร้องเรียน…"
                className={cn(fieldCls, "h-auto py-2 resize-none")}
              />
            </div>
          )}
        </div>

        {p.updatedBy && (
          <div className="text-label text-text-subtle num border-t border-border pt-2.5">
            อัปเดตล่าสุดโดย {p.updatedBy}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
