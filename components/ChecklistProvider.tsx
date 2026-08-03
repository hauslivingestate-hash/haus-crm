"use client";

import * as React from "react";
import {
  SEED_CHECKLIST_TEMPLATES,
  type ChecklistTemplate,
  type FocusTier,
} from "@/lib/checklists";
import { potentialGroup } from "@/lib/status";

// Shared LIVE store for value-add checklists — the single source both the Settings template
// editor (write) and the listing Checklist card (read/tick) use. Editing a template in
// Settings immediately changes what every A-List/Exclusive listing shows.
//
// Mirrors MasterDataProvider / RbacProvider: in-memory, design-first, resets on reload.
// Two layers of state:
//   • templates  — the definitions (edited in Settings)
//   • progress   — per-listing item state keyed [listingId][templateItemId]
// Progress is a LIVE-JOIN against templates (not a snapshot): a row exists only once an item
// is touched. Wire later = the tables in lib/checklists.ts; this becomes a fetch+mutation layer.

// Per-listing state for one checklist item. Which field carries "done" depends on the item
// type: completedAt (task/date) · docName (document) · url (link) · dueDate + repeatDays (cadence).
export interface ChecklistItemState {
  completedAt: string | null; // ISO timestamp — task/date completion
  completedBy: string | null; // rbac user id
  dueDate: string | null; // "YYYY-MM-DD" — due date (date) or last-posted date (cadence)
  url: string | null; // for type="link" — copywriting template / portal post URL
  docName: string | null; // for type="document" — design-first preview only
  note: string | null;
}

export const EMPTY_ITEM_STATE: ChecklistItemState = {
  completedAt: null,
  completedBy: null,
  dueDate: null,
  url: null,
  docName: null,
  note: null,
};

type ProgressMap = Record<string, Record<string, ChecklistItemState>>;

// Exclusive listing agreement — the signed exclusive-listing contract's term (Exclusive tier
// only). We commit to selling within this window, so `end` drives the expiry warning and, later,
// renewal reminders. Wire later = agreement_start / agreement_end date columns on the listing.
export interface ExclusiveAgreement {
  start: string | null; // "YYYY-MM-DD" — agreement signed / effective date
  end: string | null; // "YYYY-MM-DD" — agreement expiry (commitment deadline)
}

export const EMPTY_AGREEMENT: ExclusiveAgreement = { start: null, end: null };

interface ChecklistValue {
  templates: ChecklistTemplate[];
  setTemplates: React.Dispatch<React.SetStateAction<ChecklistTemplate[]>>;
  /** Templates that apply to a listing's potential tier (empty for Normal). */
  templatesFor: (potential: string | null | undefined) => ChecklistTemplate[];
  /** Current per-listing state for an item (falls back to EMPTY_ITEM_STATE). */
  stateFor: (listingId: string, itemId: string) => ChecklistItemState;
  patchState: (listingId: string, itemId: string, patch: Partial<ChecklistItemState>) => void;
  /** "Date A List" — when the listing was submitted as A-List (listing metadata). Wire later
   *  = a timestamp column auto-stamped when potential is set; editable preview for now. */
  aListDateFor: (listingId: string) => string | null;
  setAListDate: (listingId: string, date: string | null) => void;
  /** Exclusive-tier only — the signed agreement's start/end window (Exclusive listings commit
   *  to a sell-by deadline). Wire later = agreement_start / agreement_end columns. */
  exclusiveAgreementFor: (listingId: string) => ExclusiveAgreement;
  setExclusiveAgreement: (listingId: string, patch: Partial<ExclusiveAgreement>) => void;
}

const Ctx = React.createContext<ChecklistValue | null>(null);

export function ChecklistProvider({ children }: { children: React.ReactNode }) {
  const [templates, setTemplates] = React.useState<ChecklistTemplate[]>(() =>
    SEED_CHECKLIST_TEMPLATES.map((t) => ({
      ...t,
      appliesTo: [...t.appliesTo],
      items: t.items.map((i) => ({ ...i })),
    }))
  );
  const [progress, setProgress] = React.useState<ProgressMap>({});
  const [aListDates, setAListDates] = React.useState<Record<string, string | null>>({});
  const [agreements, setAgreements] = React.useState<Record<string, ExclusiveAgreement>>({});

  const templatesFor = React.useCallback(
    (potential: string | null | undefined) => {
      const group = potentialGroup(potential);
      if (group === "normal") return [];
      const tier = group as FocusTier;
      return templates.filter((t) => t.appliesTo.includes(tier));
    },
    [templates]
  );

  const stateFor = React.useCallback(
    (listingId: string, itemId: string): ChecklistItemState =>
      progress[listingId]?.[itemId] ?? EMPTY_ITEM_STATE,
    [progress]
  );

  const patchState = React.useCallback(
    (listingId: string, itemId: string, patch: Partial<ChecklistItemState>) =>
      setProgress((prev) => {
        const forListing = prev[listingId] ?? {};
        const prevItem = forListing[itemId] ?? EMPTY_ITEM_STATE;
        return {
          ...prev,
          [listingId]: { ...forListing, [itemId]: { ...prevItem, ...patch } },
        };
      }),
    []
  );

  const aListDateFor = React.useCallback(
    (listingId: string) => aListDates[listingId] ?? null,
    [aListDates]
  );
  const setAListDate = React.useCallback(
    (listingId: string, date: string | null) =>
      setAListDates((prev) => ({ ...prev, [listingId]: date })),
    []
  );

  const exclusiveAgreementFor = React.useCallback(
    (listingId: string) => agreements[listingId] ?? EMPTY_AGREEMENT,
    [agreements]
  );
  const setExclusiveAgreement = React.useCallback(
    (listingId: string, patch: Partial<ExclusiveAgreement>) =>
      setAgreements((prev) => ({
        ...prev,
        [listingId]: { ...(prev[listingId] ?? EMPTY_AGREEMENT), ...patch },
      })),
    []
  );

  const value: ChecklistValue = {
    templates,
    setTemplates,
    templatesFor,
    stateFor,
    patchState,
    aListDateFor,
    setAListDate,
    exclusiveAgreementFor,
    setExclusiveAgreement,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useChecklists(): ChecklistValue {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useChecklists must be used within ChecklistProvider");
  return ctx;
}
