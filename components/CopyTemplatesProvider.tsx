"use client";

import * as React from "react";
import {
  defaultTemplate,
  defaultTemplateMap,
  splitKey,
  type CopyTemplate,
} from "@/lib/listingCopy";

// Shared LIVE store for the ad-copy ("คำประกาศโฆษณา") templates. Both the Settings matrix editor
// (write) and the listing "สร้างคำโฆษณา" drawer (read) use it, so an edit in Settings changes the
// generated copy everywhere. Seeded from the code defaults (lib/listingCopy.ts) — mirrors the
// MasterDataProvider / ChecklistProvider pattern. In-memory, design-first, resets on reload.
// Wire later = a `listing_templates` table of overrides keyed grade|type.

interface CopyTemplatesValue {
  templates: Record<string, CopyTemplate>;
  setTemplate: (key: string, patch: Partial<CopyTemplate>) => void;
  resetTemplate: (key: string) => void;
}

const Ctx = React.createContext<CopyTemplatesValue | null>(null);

export function CopyTemplatesProvider({ children }: { children: React.ReactNode }) {
  const [templates, setTemplates] = React.useState<Record<string, CopyTemplate>>(() =>
    defaultTemplateMap()
  );

  const setTemplate = React.useCallback(
    (key: string, patch: Partial<CopyTemplate>) =>
      setTemplates((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } })),
    []
  );

  const resetTemplate = React.useCallback(
    (key: string) =>
      setTemplates((prev) => ({ ...prev, [key]: defaultTemplate(...splitKey(key)) })),
    []
  );

  const value: CopyTemplatesValue = { templates, setTemplate, resetTemplate };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCopyTemplates(): CopyTemplatesValue {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useCopyTemplates must be used within CopyTemplatesProvider");
  return ctx;
}
