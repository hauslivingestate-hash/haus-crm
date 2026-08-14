"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SEED_SALES_RANKS, type SalesRank } from "@/lib/probation";
import { saveSalesRanks } from "@/lib/mutations/probation";

// The new-sales ladder, shared by the Settings editor (write) and the เซลล์ใหม่ board
// (read). Editing a rank's criteria re-derives everyone's position, because a rank is
// derived, not stored.
//
// Phase 8 groundwork: the ranks come from `probation_rank` / `rank_criterion` now. The seed
// remains only as the fallback for a render with no session — the CEO's edits used to live
// in this provider alone and vanished on reload.
//
// `ranks` is still local state on purpose: the editor is a multi-step form (add a rank, add
// its criteria, set targets) and saving on every keystroke would write a half-built ladder.
// `save()` commits, `reset()` throws the draft away.

interface ProbationValue {
  ranks: SalesRank[];
  setRanks: React.Dispatch<React.SetStateAction<SalesRank[]>>;
  /** Draft differs from what was last loaded from the server. */
  dirty: boolean;
  save: () => Promise<boolean>;
  reset: () => void;
  busy: boolean;
  error: string | null;
}

const Ctx = React.createContext<ProbationValue | null>(null);

const clone = (rs: SalesRank[]) => rs.map((r) => ({ ...r, criteria: r.criteria.map((c) => ({ ...c })) }));

export function ProbationProvider({
  children,
  initial,
}: {
  children: React.ReactNode;
  initial?: SalesRank[];
}) {
  const router = useRouter();
  const server = initial ?? SEED_SALES_RANKS;
  const [ranks, setRanks] = React.useState<SalesRank[]>(() => clone(server));
  const [saving, setSaving] = React.useState(false);
  const [refreshing, startRefresh] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const serverKey = JSON.stringify(server);
  // Adopt fresh server data only when it actually changed — a router.refresh() for some
  // other reason must not wipe a ladder being edited.
  React.useEffect(() => {
    setRanks(clone(JSON.parse(serverKey) as SalesRank[]));
  }, [serverKey]);

  const dirty = JSON.stringify(ranks) !== serverKey;

  const save = React.useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await saveSalesRanks(ranks);
      if (!res.ok) {
        setError(res.error);
        return false;
      }
      startRefresh(() => router.refresh());
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่");
      return false;
    } finally {
      setSaving(false);
    }
  }, [ranks, router]);

  const reset = React.useCallback(() => {
    setRanks(clone(JSON.parse(serverKey) as SalesRank[]));
    setError(null);
  }, [serverKey]);

  return (
    <Ctx.Provider
      value={{ ranks, setRanks, dirty, save, reset, busy: saving || refreshing, error }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useProbation(): ProbationValue {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useProbation must be used within ProbationProvider");
  return ctx;
}
