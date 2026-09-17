"use client";

import { LeadIntakeFab } from "@/components/LeadIntakeFab";
import { ParseTray } from "@/components/ParseTray";
import { ListingReviewHost } from "@/components/ListingReviewHost";
import type { AgentOption } from "@/components/LeadForm";

/* The bottom-right corner, owned in one place.
 *
 * There are now two floating things — the AI paste tray and เพิ่มลีด — and each is gated on
 * a different permission. If both positioned themselves with their own `fixed` they would
 * overlap for anyone holding both, and leave a hole at the bottom for anyone holding only
 * the upper one.
 *
 * So the STACK is fixed and its children are not. Each renders null when ungated and the
 * column closes up by itself, whichever combination a person holds.
 *
 * Order is deliberate: เพิ่มลีด sits lowest because it is the primary action and the one
 * that has to stay thumb-reachable (CEO feedback R1: "FAB เหลือแค่เพิ่มลีด"). The tray
 * stacks above it.
 */
export function FabDock({ agents }: { agents: AgentOption[] }) {
  return (
    <div className="fixed right-5 bottom-5 z-40 flex flex-col items-end gap-3">
      <ParseTray />
      <LeadIntakeFab agents={agents} />
      {/* Not a visible member of the stack — it only ever renders a full-screen modal, and
          only when a listing draft is opened from the tray. It sits here because this is
          already the one component mounted app-wide that knows about the queue. */}
      <ListingReviewHost />
    </div>
  );
}
