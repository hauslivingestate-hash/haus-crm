"use client";

import * as React from "react";
import { SEED_SALES_RANKS, type SalesRank } from "@/lib/probation";

// Shared LIVE store for the new-sales probation ladder — the single source both the
// Settings rank editor (write) and the เซลล์ใหม่ board (read) use. Editing a rank's
// criteria immediately re-derives everyone's position (auto-promote = pure derivation).
//
// Mirrors MasterDataProvider / ChecklistProvider: in-memory, design-first, resets on
// reload. Wire later = probation_rank + rank_criterion tables (see PROBATION_FEATURE.md);
// this becomes a fetch+mutation layer.

interface ProbationValue {
  ranks: SalesRank[];
  setRanks: React.Dispatch<React.SetStateAction<SalesRank[]>>;
}

const Ctx = React.createContext<ProbationValue | null>(null);

export function ProbationProvider({ children }: { children: React.ReactNode }) {
  const [ranks, setRanks] = React.useState<SalesRank[]>(() =>
    SEED_SALES_RANKS.map((r) => ({ ...r, criteria: r.criteria.map((c) => ({ ...c })) }))
  );
  return <Ctx.Provider value={{ ranks, setRanks }}>{children}</Ctx.Provider>;
}

export function useProbation(): ProbationValue {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useProbation must be used within ProbationProvider");
  return ctx;
}
