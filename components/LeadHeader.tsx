"use client";

import * as React from "react";
import { Phone, MessageSquare, Pencil } from "lucide-react";
import type { CrmRow } from "@/lib/queries";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { LeadEditSheet } from "@/components/LeadEditSheet";
import { useRbac } from "@/components/RbacProvider";

// Lead detail identity header — name/id + tappable contact (phone + LINE), and an แก้ไข
// button that opens the edit sheet (gated to leads.edit). Replaces the old นัดชม/ติดต่อ
// buttons with the actual contact channels admin/sales need.
export function LeadHeader({ lead }: { lead: CrmRow }) {
  const { can } = useRbac();
  const [edit, setEdit] = React.useState(false);
  const lineId = lead.line_id?.trim();

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="flex items-center gap-3 min-w-0">
        <Avatar name={lead.lead_name} tone="crimson" className="h-10 w-10 shrink-0" />
        <div className="min-w-0">
          <div className="num text-[11px] text-text-subtle">{lead.lead_id}</div>
          <h1 className="text-h1 truncate">{lead.lead_name ?? lead.lead_id}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
            {lead.phone ? (
              <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1 text-small text-text-muted hover:text-accent transition-colors num">
                <Phone size={12} strokeWidth={1.75} /> {lead.phone}
              </a>
            ) : (
              <span className="text-small text-text-subtle">ไม่มีเบอร์โทร</span>
            )}
            {lineId ? (
              <a
                href={`https://line.me/ti/p/~${lineId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-small text-text-muted hover:text-green transition-colors"
              >
                <MessageSquare size={12} strokeWidth={1.75} /> LINE: <span className="num">{lineId}</span>
              </a>
            ) : (
              <span className="inline-flex items-center gap-1 text-small text-text-subtle">
                <MessageSquare size={12} strokeWidth={1.75} /> ไม่มี LINE
              </span>
            )}
          </div>
        </div>
      </div>

      {can("leads.edit") && (
        <div className="shrink-0 sm:ml-auto">
          <Button variant="secondary" size="sm" onClick={() => setEdit(true)}>
            <Pencil size={14} strokeWidth={1.75} /> แก้ไข
          </Button>
        </div>
      )}

      <LeadEditSheet open={edit} lead={lead} onClose={() => setEdit(false)} />
    </div>
  );
}
