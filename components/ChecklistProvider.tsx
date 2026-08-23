"use client";

import * as React from "react";
import { templatesForTier, type ChecklistTemplate } from "@/lib/checklists";
import { potentialGroup } from "@/lib/status";

// Distributes the checklist DEFINITIONS to whoever needs them — the listing card and the
// Settings editor.
//
// READ-ONLY. This used to hold the templates AND every listing's progress AND the Exclusive
// agreement dates, all in React state: rearranging a template in Settings changed what every
// listing showed instantly, ticking a step looked saved, and a reload wiped all of it. All
// three now live in the database (`checklist_template`, `listing_checklist_item`, and
// agreement_start/end on the listing), so this only hands out what the server sent.
//
// Per-listing progress is NOT here — it is loaded by the listing page and passed to
// ListingChecklist directly. Holding a map of every listing's ticks in a layout-level provider
// would mean fetching the whole company's checklist state on every page.

interface ChecklistValue {
  templates: ChecklistTemplate[];
  /** Templates that apply to a listing's potential tier (empty for Normal). */
  templatesFor: (potential: string | null | undefined) => ChecklistTemplate[];
}

const Ctx = React.createContext<ChecklistValue | null>(null);

export function ChecklistProvider({
  templates = [],
  children,
}: {
  templates?: ChecklistTemplate[];
  children: React.ReactNode;
}) {
  const templatesFor = React.useCallback(
    (potential: string | null | undefined) =>
      templatesForTier(templates, potentialGroup(potential)),
    [templates]
  );

  const value = React.useMemo<ChecklistValue>(
    () => ({ templates, templatesFor }),
    [templates, templatesFor]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useChecklists(): ChecklistValue {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useChecklists must be used within ChecklistProvider");
  return ctx;
}
