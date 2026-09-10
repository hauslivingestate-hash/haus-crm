/* What sits behind one bar of ความเคลื่อนไหว.
 *
 * Types only — the query lives in lib/mutations/movementDrill.ts, which is a "use server"
 * module and therefore may export nothing but async functions. Splitting them is not a
 * style choice; a type exported from a server-action file is a build error.
 *
 * ── WHY IT LOADS ON TAP AND NOT WITH THE PAGE ───────────────────────────────────
 * The card draws ~25 bars. Shipping every bar's case list with the dashboard would send
 * a few thousand rows to answer a question nobody has asked yet, and the dashboard is
 * already four parallel queries deep. One tap, one query.
 */

/** Which bar was tapped. `view` matters on a stage row because the same step means two
    different sets depending on which half of the toggle is showing — the actions logged
    at that step, or the leads that reached it. */
export type DrillTarget =
  | { of: "action"; name: string }
  | { of: "stage"; stage: string; view: "actions" | "funnel" }
  | { of: "ownerStage"; stage: string; view: "actions" | "funnel" };

export interface DrillCase {
  /** Decides where the row links to — /leads or /listings. */
  side: "lead" | "listing";
  id: string;
  name: string;
  /** The date the row is counted on: the activity's date, the lead's intake, the
      listing's creation. Null only when the source row has none. */
  date: string | null;
  /** The action logged, for an activity drill. */
  kind?: string | null;
  /** Means something different per target — a remark, a stage, an owner step — so the UI
      renders it through a per-target branch rather than as loose prose. */
  detail?: string | null;
}

export function isFunnelDrill(t: DrillTarget): boolean {
  return t.of !== "action" && t.view === "funnel";
}

/** A stable string for one target, for React keys and effect dependencies. The target
    object is rebuilt on every render, so comparing it by reference would refetch the
    modal's list on every keystroke anywhere in the card. */
export function drillKey(t: DrillTarget): string {
  switch (t.of) {
    case "action":
      return `action:${t.name}`;
    case "stage":
      return `stage:${t.stage}:${t.view}`;
    case "ownerStage":
      return `ownerStage:${t.stage}:${t.view}`;
  }
}
