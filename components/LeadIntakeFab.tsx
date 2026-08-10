"use client";

import * as React from "react";
import { UserPlus } from "lucide-react";
import { useRbac } from "@/components/RbacProvider";
import { LeadForm, type AgentOption } from "@/components/LeadForm";
import { cn } from "@/lib/cn";

// Lead-intake FAB — for whoever receives leads across channels and logs them. Gated to
// leads.create (Admin / Listing Support / Sales Leader / CEO).
//
// This is now the ONLY FAB (CEO feedback R1: "FAB เหลือแค่เพิ่มลีด"). The activity-logger
// FAB it used to stack above was deleted; activity is recorded by completing a Daily-Plan
// task instead. Hence the fixed bottom-5 — there is nothing left to avoid overlapping.
export function LeadIntakeFab({ agents }: { agents: AgentOption[] }) {
  const { can, currentUser } = useRbac();
  const [open, setOpen] = React.useState(false);

  if (!can("leads.create")) return null;
  const mode = can("leads.assign") ? "admin" : "rep";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="เพิ่มลีด"
        className={cn(
          "fixed right-5 bottom-5 z-40 inline-flex items-center gap-2 rounded-full bg-accent text-text-onaccent h-12 pl-4 pr-5 shadow-pop hover:bg-accent-hover transition-colors font-medium"
        )}
      >
        <UserPlus size={18} strokeWidth={2.25} /> เพิ่มลีด
      </button>
      <LeadForm open={open} mode={mode} createdBy={currentUser.name} agents={agents} onClose={() => setOpen(false)} />
    </>
  );
}
