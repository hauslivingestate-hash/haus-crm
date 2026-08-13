// The `LastMatch` shape and the pure helpers over it — a ledger of closed deals,
// one row per match, owned by a `sale_id`.
//
// Phase 6 removed the sample rows; `getLastMatches()` in lib/queries.ts reads
// `main_7_last_match`. The queries live there because LastMatchBrowser is a client
// component and imports these helpers as values.
//
// SCOPING is now the DATABASE's job. `main_7_last_match`'s SELECT policy is already
// own → team → all keyed on lastmatch.view_* , so the query returns exactly what the
// viewer may see. The client-side `scopeMatches()` that used to re-filter here is gone:
// it mapped seed user ids to seed employee codes, which stopped resolving the moment
// real sessions arrived, and a client filter never enforced anything anyway.

export type CloseType =
  | "ปิดเอง" // we closed it
  | "เจ้าของขายเอง" // owner sold direct
  | "เอเจ้นอื่นสอยไป" // another agent took it
  | "มือ 1" // developer / new
  | "ไม่รู้";

export interface LastMatch {
  last_match_id: string;
  sale_id: string | null;
  /** Nickname for display — `sale_id` is an employee code and must not be shown raw. */
  sale_name: string | null;
  close_type: CloseType | null;
  project_name: string | null;
  property_type: string | null;
  zone: string | null; // zone code, e.g. "CYP"
  zone_name_thai: string | null;
  sq_wa: number | null;
  sq_m: number | null;
  bed: number | null;
  bath: number | null;
  last_match_price: number | null;
  last_match_remark: string | null;
  buyer_persona: string | null;
  date_created: string | null; // ISO date
}

// ── Scoping ──────────────────────────────────────────────────────────────────
export type MatchScope = "all" | "team" | "own" | "none";

/**
 * The viewer's Last Match scope, read from their effective permissions.
 * Widest wins, so a player-coach holding both Agent and Sales Leader sees their team.
 *
 * Used only to decide PRESENTATION now (whether a เซลส์ column is worth showing, and
 * whether to say "no access" instead of "no rows") — the rows themselves are already
 * scoped by RLS before they reach the browser.
 */
export function matchScope(can: (perm: string) => boolean): MatchScope {
  if (can("lastmatch.view_all")) return "all";
  if (can("lastmatch.view_team")) return "team";
  if (can("lastmatch.view_own")) return "own";
  return "none";
}

const CLOSE_TONE: Record<string, "green" | "neutral" | "amber" | "blue"> = {
  ปิดเอง: "green",
  เจ้าของขายเอง: "neutral",
  เอเจ้นอื่นสอยไป: "amber",
  "มือ 1": "blue",
  ไม่รู้: "neutral",
};

export function closeTypeTone(t: string | null | undefined): "green" | "neutral" | "amber" | "blue" {
  return (t && CLOSE_TONE[t]) || "neutral";
}

/** "62 ตร.วา · 245 ตร.ม." style size summary from the split columns. */
export function sizeSummary(m: LastMatch): string {
  const parts: string[] = [];
  if (m.sq_wa != null) parts.push(`${m.sq_wa} ตร.วา`);
  if (m.sq_m != null) parts.push(`${m.sq_m} ตร.ม.`);
  return parts.join(" · ") || "—";
}
