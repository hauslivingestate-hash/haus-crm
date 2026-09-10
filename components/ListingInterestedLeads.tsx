"use client";

/* ผู้สนใจ — the buyers whose lead points at this unit.
 *
 * Replaces a "เร็ว ๆ นี้" placeholder that had never shown anything. The data was always
 * there: `main_6_buyer_crm.listing_code`, the same link the lead page reads in the other
 * direction, on 977 leads across 251 listings.
 *
 * ── LIVE FIRST, THE REST BEHIND A TOGGLE ────────────────────────────────────────
 * One listing carries 57 leads. Most of them are old enquiries that went nowhere, and a
 * list where the four people worth calling sit under fifty who are not is a list nobody
 * reads. Lose / Reject / Win are folded away by default — but folded, not hidden: a closed
 * enquiry is still history, and the count says how many there are.
 *
 * ⚠️ THIS LIST IS RLS-SCOPED. An agent without leads.view_all sees only their own leads, so
 * the card says "ที่คุณเห็น" rather than presenting a company-wide count it does not have. */

import * as React from "react";
import Link from "next/link";
import { Users, ChevronDown } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Dot, StatusBadge } from "@/components/ui/Dot";
import { GradeChip } from "@/components/ui/GradeChip";
import { useRbac } from "@/components/RbacProvider";
import type { InterestedLead } from "@/lib/queries";
import { stageMeta } from "@/lib/pipeline";
import { leadStatusDot } from "@/lib/status";
import { formatBaht, formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";

/** Statuses that mean the enquiry is over, either way. */
const CLOSED = new Set(["Lose", "Reject", "Win"]);

export function ListingInterestedLeads({
  leads,
  nicknameOf,
}: {
  leads: InterestedLead[];
  /** employee_code → display name, resolved by the server. */
  nicknameOf: Record<string, string>;
}) {
  const { can } = useRbac();
  const [showAll, setShowAll] = React.useState(false);

  const live = leads.filter((l) => !CLOSED.has(l.lead_status ?? ""));
  const closed = leads.filter((l) => CLOSED.has(l.lead_status ?? ""));
  const shown = showAll ? [...live, ...closed] : live;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users size={16} strokeWidth={1.75} className="text-text-muted" />
          ผู้สนใจ
          {live.length > 0 && <span className="num text-text-subtle">{live.length}</span>}
        </CardTitle>
        {closed.length > 0 && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="inline-flex items-center gap-1 text-label text-text-muted hover:text-text transition-colors"
          >
            {showAll ? "ซ่อนที่ปิดแล้ว" : `ดูทั้งหมด (${leads.length})`}
            <ChevronDown
              size={13}
              strokeWidth={1.75}
              className={cn("transition-transform", showAll && "rotate-180")}
            />
          </button>
        )}
      </CardHeader>

      {shown.length === 0 ? (
        <CardContent>
          <p className="py-4 text-center text-small text-text-subtle">
            {leads.length === 0
              ? "ยังไม่มีลูกค้าที่สนใจทรัพย์นี้"
              : "ไม่มีผู้สนใจที่ยังติดตามอยู่"}
          </p>
        </CardContent>
      ) : (
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {shown.map((l) => {
              const stg = stageMeta(l.pipeline_stage);
              const isClosed = CLOSED.has(l.lead_status ?? "");
              return (
                <li key={l.lead_id}>
                  <Link
                    href={`/leads/${l.lead_id}`}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-hover",
                      // Dimmed, not removed: a dead enquiry is context, not a candidate.
                      isClosed && "opacity-60"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {l.potential && <GradeChip grade={l.potential} />}
                        <span className="text-body font-medium truncate">
                          {l.lead_name ?? l.lead_id}
                        </span>
                        {isClosed && (
                          <StatusBadge color={leadStatusDot(l.lead_status)}>
                            {l.lead_status}
                          </StatusBadge>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-label text-text-subtle">
                        <span className="inline-flex items-center gap-1 whitespace-nowrap">
                          <Dot className={stg.dot} /> {stg.label}
                        </span>
                        {l.budget != null && <span className="num">{formatBaht(l.budget)}</span>}
                        {/* The phone is the point of this card — but only for whoever may
                            see it. Everyone else gets the name and the link. */}
                        {l.phone && can("contacts.view_all") && (
                          <span className="num">{l.phone}</span>
                        )}
                        {l.sale_id && <span>{nicknameOf[l.sale_id] ?? l.sale_id}</span>}
                      </div>
                    </div>
                    <span className="num shrink-0 text-label text-text-subtle">
                      {formatDate(l.date_received)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Said once, at the bottom, rather than dressed up as a total. */}
          {!can("leads.view_all") && (
            <p className="border-t border-border px-4 py-2 text-label text-text-subtle">
              แสดงเฉพาะลีดที่คุณดูแล
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}
