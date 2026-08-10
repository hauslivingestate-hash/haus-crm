"use client";

import * as React from "react";
import { INTAKE_TODAY } from "@/lib/leads";

// Design-first shared store for the lead ASSIGNMENT flow. Holds:
//  • assignment overrides for a lead, keyed by lead_id,
//  • a reassign audit trail per lead (shown on the lead-detail timeline).
// Wire (Phase 5 #4): replace `assign` with an update on main_6_buyer_crm.sale_id + an
// audit_log row, and this provider goes away entirely.
//
// Two other things used to live here and no longer do, because they are real writes now:
// tag + complaint state (Phase 5 #2 → lib/mutations/leads.ts) and optimistic NEW leads
// (Phase 5 #3 → create_lead RPC). New leads come back from the server on refresh, so
// carrying a local copy would only risk showing a second, stale version of the same row.

export interface AssignEvent {
  at: string; // ISO datetime
  from: string; // "" = unassigned
  to: string;
  by: string; // actor nickname
}

interface Ctx {
  assignments: Record<string, string>; // lead_id → sale override
  historyOf: (leadId: string) => AssignEvent[];
  assign: (leadId: string, to: string, by: string, from: string) => void;
}

const NewLeadsContext = React.createContext<Ctx | null>(null);

export function NewLeadsProvider({ children }: { children: React.ReactNode }) {
  const [assignments, setAssignments] = React.useState<Record<string, string>>({});
  const [history, setHistory] = React.useState<Record<string, AssignEvent[]>>({});

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
    <NewLeadsContext.Provider value={{ assignments, historyOf, assign }}>
      {children}
    </NewLeadsContext.Provider>
  );
}

export function useNewLeads(): Ctx {
  const c = React.useContext(NewLeadsContext);
  if (!c) throw new Error("useNewLeads must be used within NewLeadsProvider");
  return c;
}
