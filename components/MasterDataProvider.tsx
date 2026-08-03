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
}

const Ctx = React.createContext<MasterDataValue | null>(null);

export function MasterDataProvider({ children }: { children: React.ReactNode }) {
  const [propertyTypes, setPropertyTypes] = React.useState<RefItem[]>(() =>
    PROPERTY_TYPES.map((s) => ({ id: s, label: s }))
  );
  const [sources, setSources] = React.useState<RefItem[]>(() =>
    LEAD_SOURCES.map((s) => ({ id: s.id, label: s.label }))
  );
  const [contactBys, setContactBys] = React.useState<RefItem[]>(() =>
    CONTACT_BYS.map((c) => ({ id: c.id, label: c.label }))
  );
  const [genders, setGenders] = React.useState<RefItem[]>(() =>
    GENDERS.map((g) => ({ id: g.id, label: g.label }))
  );
  const [nationalities, setNationalities] = React.useState<RefItem[]>(() =>
    NATIONALITIES.map((n) => ({ id: n, label: n }))
  );
  const [leadTags, setLeadTags] = React.useState<LeadTag[]>(() => [...SEED_LEAD_TAGS]);

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
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMasterData(): MasterDataValue {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useMasterData must be used within MasterDataProvider");
  return ctx;
}
