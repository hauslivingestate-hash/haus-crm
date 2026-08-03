"use client";

import * as React from "react";
import { INTAKE_TODAY, type NewLead, type LeadProcess } from "@/lib/leads";
import { seedTagForLead } from "@/lib/tags";

// Design-first shared store for the lead intake + assignment flow. Holds:
//  • optimistic NEW leads created via the FAB (not persisted — no Supabase write yet),
//  • assignment overrides for ANY lead (real or new), keyed by lead_id,
//  • a reassign audit trail per lead (shown on the lead-detail timeline).
// Wire: replace addLead with a Supabase insert + refetch; assign with an update + an
// audit_log row. The context keeps the whole app (assign table + detail) in sync meanwhile.

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
  processOf: (leadId: string) => LeadProcess;
  setProcess: (leadId: string, patch: Partial<LeadProcess>, by: string) => void;
  /** Lead group tag — ONE per lead (CEO feedback R1). Held here rather than in
   *  LeadsBrowser's local state so the table and the lead DETAIL page can't disagree.
   *  Wire = `main_6_buyer_crm.tag_id`. */
  tagOf: (leadId: string) => string | null;
  setTag: (leadId: string, tagId: string | null) => void;
}

const NewLeadsContext = React.createContext<Ctx | null>(null);

export function NewLeadsProvider({ children }: { children: React.ReactNode }) {
  const [newLeads, setNewLeads] = React.useState<NewLead[]>([]);
  const [assignments, setAssignments] = React.useState<Record<string, string>>({});
  const [history, setHistory] = React.useState<Record<string, AssignEvent[]>>({});
  const [process, setProcessState] = React.useState<Record<string, LeadProcess>>({});
  // lead_id → tag id (or null). Lazily seeded: a lead absent from this map falls back to
  // the deterministic demo seed, so the table shows realistic distribution without having
  // to enumerate every lead up front.
  const [tags, setTags] = React.useState<Record<string, string | null>>({});

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

  const processOf = React.useCallback((leadId: string) => process[leadId] ?? {}, [process]);
  const setProcess = React.useCallback((leadId: string, patch: Partial<LeadProcess>, by: string) => {
    setProcessState((p) => ({
      ...p,
      [leadId]: { ...p[leadId], ...patch, updatedBy: by, updatedAt: `${INTAKE_TODAY}T00:00:00+07:00` },
    }));
  }, []);

  const tagOf = React.useCallback(
    (leadId: string) => (leadId in tags ? tags[leadId] : seedTagForLead(leadId)),
    [tags]
  );
  /**
   * Single-select assignment. Sets exactly what it's given — pass `null` to clear.
   *
   * Deliberately NOT a toggle: in a picker where you click a row to choose, clicking the
   * already-selected row silently wiping the tag is a trap. Clearing is an explicit
   * "เอาแท็กออก" action instead.
   */
  const setTag = React.useCallback((leadId: string, tagId: string | null) => {
    setTags((m) => ({ ...m, [leadId]: tagId }));
  }, []);

  return (
    <NewLeadsContext.Provider
      value={{ newLeads, addLead, assignments, historyOf, assign, processOf, setProcess, tagOf, setTag }}
    >
      {children}
    </NewLeadsContext.Provider>
  );
}

export function useNewLeads(): Ctx {
  const c = React.useContext(NewLeadsContext);
  if (!c) throw new Error("useNewLeads must be used within NewLeadsProvider");
  return c;
}
