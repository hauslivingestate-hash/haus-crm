"use client";

/* The drawer's first frame: the lead as the grid already knows it.
 *
 * Rendered by the drawer's loading.tsx, so it is on screen the instant the panel slides
 * in — before the server has answered. Everything here is a REAL component fed the row
 * that was clicked (lib/peek.ts), not a copy of the detail view: the header is the same
 * header, and the จัดการ pills are live, so a stage can be changed before the rest of the
 * lead has finished loading.
 *
 * Only what genuinely needs the server is a skeleton — the activity log, the deal's
 * asking-price comparison, the admin panel.
 *
 * Falls back to plain skeletons when there is no stashed row: a cold link, a refresh, or
 * a second tab. Nothing here is ever saved as truth. */

import { usePathname } from "next/navigation";
import { Skeleton } from "@/components/ui/Skeleton";
import { LeadHeader } from "@/components/LeadHeader";
import { LeadManageCard } from "@/components/LeadManageCard";
import { peekLead } from "@/lib/peek";

/* No props. Next's loading.tsx "do not accept any parameters" — not params, not
   searchParams — so the lead being opened is read from the URL, which the router has
   already advanced to /leads/:id by the time this fallback renders. */
export function LeadPeek() {
  const id = decodeURIComponent(usePathname().split("/").filter(Boolean).pop() ?? "");
  const row = peekLead(id);

  if (!row) {
    return (
      <div className="p-4 lg:p-5 space-y-4">
        <div className="flex items-center gap-3 pr-11">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-56 w-full rounded-lg" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-5 space-y-4">
      <div className="pr-11">
        <LeadHeader lead={row} />
      </div>

      {/* Live, not a placeholder. The most-used control on the screen works immediately. */}
      <LeadManageCard
        leadId={row.lead_id}
        stage={row.pipeline_stage}
        status={row.lead_status}
        potential={row.potential}
      />

      {/* The parts that genuinely have to come from the server. */}
      <Skeleton className="h-56 w-full rounded-lg" />
      <Skeleton className="h-40 w-full rounded-lg" />
    </div>
  );
}
