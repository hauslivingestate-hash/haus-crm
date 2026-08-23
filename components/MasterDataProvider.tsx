"use client";

import * as React from "react";
import { LEAD_SOURCES, CONTACT_BYS, GENDERS, NATIONALITIES } from "@/lib/leads";
import { PROPERTY_TYPES, POTENTIALS } from "@/lib/masterdata";
import { SEED_LEAD_TAGS, type LeadTag } from "@/lib/tags";

// Shared LIVE store for the governed reference vocabularies (property type, marketing
// channel, contact-by, gender, nationality) — the single source both the Settings managers
// (write) and the intake form (read) use. This is what makes the delete-confirm's promise
// REAL: removing a value here immediately removes it from the form's dropdowns, while rows
// already holding the value keep displaying it (label lookups fall back to the raw value).
//
// Phase 6: every list here is now READ from its lookup table (lib/lookups.ts) and WRITTEN
// through lib/mutations/reference.ts. There are no setters any more — the Settings managers
// call server actions and let router.refresh() bring the new list back down. The old
// setters made the delete-confirm's promise true for exactly one page view.
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
  /** DB-only vocabularies the intake form writes as FKs. No Settings manager yet, so these
   *  are read-only — an empty list means the lookups weren't loaded (design mode). */
  leadTypes: RefItem[];
  purposes: RefItem[];
  sellReasons: RefItem[];
  listingPotentials: RefItem[];
  zones: RefItem[];
  listingStatuses: RefItem[];
  listingTypes: RefItem[];
  directions: RefItem[];
  viewTypes: RefItem[];
  unitPositions: RefItem[];
  unitConditions: RefItem[];
  inOutProjects: RefItem[];
  priceRemarks: RefItem[];
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
  listingPotentials?: RefItem[];
  zones?: RefItem[];
  listingStatuses?: RefItem[];
  listingTypes?: RefItem[];
  directions?: RefItem[];
  viewTypes?: RefItem[];
  unitPositions?: RefItem[];
  unitConditions?: RefItem[];
  inOutProjects?: RefItem[];
  priceRemarks?: RefItem[];
  leadTags?: LeadTag[];
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
  // Real `lead_tags_ref` rows; the seed is only the no-session fallback. These ids are
  // what `main_6_buyer_crm.tag_id` stores, so the seed's slugs must never reach a write.
  const leadTags = seeded(initial?.leadTags, () => [...SEED_LEAD_TAGS]);

  // Read-only here: these three exist purely so the intake form can offer DB-valid options.
  // No Settings manager edits them yet, so they need no setter.
  const leadTypes = initial?.leadTypes ?? [];
  const purposes = initial?.purposes ?? [];
  const sellReasons = initial?.sellReasons ?? [];
  // Falls back to the seed so the form still offers something without a session; the DB list
  // is the longer one (5 rows vs the seed 3).
  const listingPotentials = seeded(initial?.listingPotentials, () => POTENTIALS.map((p) => ({ id: p, label: p })));
  const zones = initial?.zones ?? [];
  // FK-backed listing vocabularies — empty without a session, which is correct:
  // a select with no options is better than one offering values the FK will reject.
  const listingStatuses = initial?.listingStatuses ?? [];
  const listingTypes = initial?.listingTypes ?? [];
  const directions = initial?.directions ?? [];
  const viewTypes = initial?.viewTypes ?? [];
  const unitPositions = initial?.unitPositions ?? [];
  const unitConditions = initial?.unitConditions ?? [];
  const inOutProjects = initial?.inOutProjects ?? [];
  const priceRemarks = initial?.priceRemarks ?? [];

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
    leadTypes,
    purposes,
    sellReasons,
    listingPotentials,
    zones,
    listingStatuses,
    listingTypes,
    directions,
    viewTypes,
    unitPositions,
    unitConditions,
    inOutProjects,
    priceRemarks,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMasterData(): MasterDataValue {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useMasterData must be used within MasterDataProvider");
  return ctx;
}
