"use client";

import * as React from "react";
import { INTAKE_TODAY, type NewLead } from "@/lib/leads";

// Design-first shared store for the lead intake + assignment flow. Holds:
//  • optimistic NEW leads created via the FAB (not persisted — no Supabase write yet),
//  • assignment overrides for ANY lead (real or new), keyed by lead_id,
//  • a reassign audit trail per lead (shown on the lead-detail timeline).
// Wire: replace addLead with a Supabase insert + refetch; assign with an update + an
// audit_log row. The context keeps the whole app (assign table + detail) in sync meanwhile.
//
// Tag + complaint-process state used to live here too (Phase 5 #1 design-phase). Both are
// real writes now (lib/mutations/leads.ts, main_6_buyer_crm.tag_id /
// customer_complain+complain_status+complain_remark) — consumers read the server-fetched
// value via props instead, so there is nothing left here for either.

export interface AssignEvent {
  at: string; // ISO datetime
  from: string; // "" = unassigned
  to: string;
  by: string; // actor nickname
}

interface Ctx {
  newLeads: NewLead[];
  addLead: (lead: NewLead) => void;
  assignments: Record<string, string>; // lead_id → sale nickname override
  historyOf: (leadId: string) => AssignEvent[];
  assign: (leadId: string, to: string, by: string, from: string) => void;
}

const NewLeadsContext = React.createContext<Ctx | null>(null);

export function NewLeadsProvider({ children }: { children: React.ReactNode }) {
  const [newLeads, setNewLeads] = React.useState<NewLead[]>([]);
  const [assignments, setAssignments] = React.useState<Record<string, string>>({});
  const [history, setHistory] = React.useState<Record<string, AssignEvent[]>>({});

  const addLead = React.useCallback((lead: NewLead) => {
    setNewLeads((xs) => [lead, ...xs]);
    if (lead.sale_id) {
      setHistory((h) => ({
        ...h,
        [lead.lead_id]: [{ at: lead.intake_at, from: "", to: lead.sale_id!, by: lead.created_by }],
      }));
    }
  }, []);

  const assign = React.useCallback((leadId: string, to: string, by: string, from: string) => {
    if (to === from) return;
    setAssignments((a) => ({ ...a, [leadId]: to }));
    setHistory((h) => ({
      ...h,
      [leadId]: [...(h[leadId] ?? []), { at: `${INTAKE_TODAY}T00:00:00+07:00`, from, to, by }],
    }));
  }, []);

  const historyOf = React.useCallback((leadId: string) => history[leadId] ?? [], [history]);

  return (
    <NewLeadsContext.Provider value={{ newLeads, addLead, assignments, historyOf, assign }}>
      {children}
    </NewLeadsContext.Provider>
  );
}

export function useNewLeads(): Ctx {
  const c = React.useContext(NewLeadsContext);
  if (!c) throw new Error("useNewLeads must be used within NewLeadsProvider");
  return c;
}
