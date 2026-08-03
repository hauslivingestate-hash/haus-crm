// Managing-agent assignment for listings — DESIGN-FIRST SAMPLE.
//
// Each listing is "owned" by the sales agent who created/manages it (source Listings tab
// `AZ Created By`, backed by per-agent listing sheets — HR Sheet col U). The live
// `v_main_listing` view doesn't expose that column yet, and the real source is effectively
// single-agent so far (all "Stone"), so this deterministically spreads listings across the
// selling agents purely so the company-wide view can DEMONSTRATE multi-agent inventory +
// co-agent discovery. Wire: read the real creating-agent from the view and delete this.

import { assignableAgents } from "@/lib/leads";
import type { Employee } from "@/lib/team";

/** Stable string hash (design-stable — no Math.random / Date). */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** The sales agent who manages a listing (design-first seed). Pool = the selling agents. */
export function listingAgent(listingId: string): Employee | undefined {
  const pool = assignableAgents();
  if (pool.length === 0) return undefined;
  return pool[hash(listingId) % pool.length];
}

/** Managing agent's nickname — the identity string used across the app. */
export function listingAgentNickname(listingId: string): string {
  return listingAgent(listingId)?.nickname ?? "";
}
