"use client";

import * as React from "react";
import { LEAD_SOURCES, CONTACT_BYS, GENDERS, NATIONALITIES } from "@/lib/leads";
import { PROPERTY_TYPES } from "@/lib/masterdata";
import { SEED_LEAD_TAGS, type LeadTag } from "@/lib/tags";

// Shared LIVE store for the governed reference vocabularies (property type, marketing
// channel, contact-by, gender, nationality) — the single source both the Settings managers
// (write) and the intake form (read) use. This is what makes the delete-confirm's promise
// REAL: removing a value here immediately removes it from the form's dropdowns, while rows
// already holding the value keep displaying it (label lookups fall back to the raw value).
//
// Mirrors the RbacProvider pattern (roles/teams): in-memory design-first, seeded from the
// constants. Wire later = `id + label` tables (+ is_active for archive-instead-of-delete);
// this provider then becomes a fetch + mutation layer over them.
//
// Item rules: seed items keep their seed ids (stored rows keep matching when a label is
// renamed); values whose stored representation IS the label (property type, nationality)
// use id = seed label; NEW custom items get id = label so raw-value display fallbacks
// render cleanly.

export interface RefItem {
  id: string;
  label: string;
}

interface MasterDataValue {
  propertyTypes: RefItem[];
  setPropertyTypes: React.Dispatch<React.SetStateAction<RefItem[]>>;
  sources: RefItem[]; // Marketing Channel
  setSources: React.Dispatch<React.SetStateAction<RefItem[]>>;
  contactBys: RefItem[];
  setContactBys: React.Dispatch<React.SetStateAction<RefItem[]>>;
  genders: RefItem[];
  setGenders: React.Dispatch<React.SetStateAction<RefItem[]>>;
  nationalities: RefItem[];
  setNationalities: React.Dispatch<React.SetStateAction<RefItem[]>>;
  /** Lead group tag — CEO-governed, SINGLE-select per lead. Carries a stored tone,
   *  so it is a LeadTag list rather than a plain RefItem list. */
  leadTags: LeadTag[];
  setLeadTags: React.Dispatch<React.SetStateAction<LeadTag[]>>;
  /** DB-only vocabularies the intake form writes as FKs. No Settings manager yet, so these
   *  are read-only — an empty list means the lookups weren't loaded (design mode). */
  leadTypes: RefItem[];
  purposes: RefItem[];
  sellReasons: RefItem[];
  zones: RefItem[];
}

const Ctx = React.createContext<MasterDataValue | null>(null);

/** Server-loaded vocabularies (lib/lookups.ts). Anything omitted falls back to the seed. */
export interface MasterDataInitial {
  propertyTypes?: RefItem[];
  sources?: RefItem[];
  contactBys?: RefItem[];
  genders?: RefItem[];
  nationalities?: RefItem[];
  leadTypes?: RefItem[];
  purposes?: RefItem[];
  sellReasons?: RefItem[];
  zones?: RefItem[];
}

export function MasterDataProvider({
  children,
  initial,
}: {
  children: React.ReactNode;
  initial?: MasterDataInitial;
}) {
  // Prefer the real lookup rows; the seeds remain only as a fallback for the (design-mode)
  // case where nothing was passed in. The seeds are NOT interchangeable with the DB values —
  // their slug ids would fail the FK on write — so a non-empty server list always wins.
  const seeded = <T,>(fromDb: T[] | undefined, fallback: () => T[]) =>
    fromDb && fromDb.length ? fromDb : fallback();

  const [propertyTypes, setPropertyTypes] = React.useState<RefItem[]>(() =>
    seeded(initial?.propertyTypes, () => PROPERTY_TYPES.map((s) => ({ id: s, label: s })))
  );
  const [sources, setSources] = React.useState<RefItem[]>(() =>
    seeded(initial?.sources, () => LEAD_SOURCES.map((s) => ({ id: s.id, label: s.label })))
  );
  const [contactBys, setContactBys] = React.useState<RefItem[]>(() =>
    seeded(initial?.contactBys, () => CONTACT_BYS.map((c) => ({ id: c.id, label: c.label })))
  );
  const [genders, setGenders] = React.useState<RefItem[]>(() =>
    seeded(initial?.genders, () => GENDERS.map((g) => ({ id: g.id, label: g.label })))
  );
  const [nationalities, setNationalities] = React.useState<RefItem[]>(() =>
    seeded(initial?.nationalities, () => NATIONALITIES.map((n) => ({ id: n, label: n })))
  );
  const [leadTags, setLeadTags] = React.useState<LeadTag[]>(() => [...SEED_LEAD_TAGS]);

  // Read-only here: these three exist purely so the intake form can offer DB-valid options.
  // No Settings manager edits them yet, so they need no setter.
  const leadTypes = initial?.leadTypes ?? [];
  const purposes = initial?.purposes ?? [];
  const sellReasons = initial?.sellReasons ?? [];
  const zones = initial?.zones ?? [];

  const value: MasterDataValue = {
    propertyTypes,
    setPropertyTypes,
    sources,
    setSources,
    contactBys,
    setContactBys,
    genders,
    setGenders,
    nationalities,
    setNationalities,
    leadTags,
    setLeadTags,
    leadTypes,
    purposes,
    sellReasons,
    zones,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMasterData(): MasterDataValue {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useMasterData must be used within MasterDataProvider");
  return ctx;
}
