"use client";

import * as React from "react";
import { defaultTemplateMap, type CopyTemplate } from "@/lib/listingCopy";

// The ad-copy ("คำประกาศโฆษณา") templates, as the whole app sees them: the code defaults from
// lib/listingCopy.ts with any saved overrides laid on top.
//
// READ-ONLY on purpose. This used to be a live store the Settings editor wrote into, which
// meant an edit changed the generated copy everywhere the moment it was typed — and vanished
// on reload. Now `listing_copy_template` holds the overrides, the editor saves to it and
// refreshes, and this provider only distributes what the server sent. There is no longer a
// state in which the app is generating copy from something the database does not have.

interface CopyTemplatesValue {
  templates: Record<string, CopyTemplate>;
  /** Which combos are stored overrides — the editor marks them and enables คืนค่าเริ่มต้น. */
  overriddenKeys: Set<string>;
}

const Ctx = React.createContext<CopyTemplatesValue | null>(null);

export function CopyTemplatesProvider({
  overrides = {},
  children,
}: {
  /** Saved rows only — usually partial, and empty on a fresh install. */
  overrides?: Record<string, CopyTemplate>;
  children: React.ReactNode;
}) {
  const value = React.useMemo<CopyTemplatesValue>(
    () => ({
      templates: { ...defaultTemplateMap(), ...overrides },
      overriddenKeys: new Set(Object.keys(overrides)),
    }),
    [overrides]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCopyTemplates(): CopyTemplatesValue {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useCopyTemplates must be used within CopyTemplatesProvider");
  return ctx;
}
