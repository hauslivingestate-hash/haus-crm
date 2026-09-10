/* Sheets-style tables — the shared vocabulary between the grid, the column
   manager and the per-user preference store.

   Ported from the Klaichan CRM (Ben, 2026-09-06), which built this after its
   own row-divider table stopped being readable past ~8 columns. Our listings
   table carries ~40 fields and leads ~30, so the same problem is ours.

   Client-safe: pure types and pure functions, no DB import. The read lives in
   lib/tables/queries.ts and the write in lib/tables/actions.ts.

   THE REGISTRY IS CODE, THE PREFERENCES ARE DATA. Which columns EXIST, what
   they are called and how a cell renders are decisions with code behind them;
   the order they sit in and which ones a person hides are not. That is why
   `resolve` treats a stored order as advisory and re-derives the real set from
   the registry on every read. */

import type { ReactNode } from "react";

/** The grids that carry a column manager. A key here needs a registry in the
    browser component and nothing else — the store validates against this
    list, so adding one is not a migration. */
export const TABLE_KEYS = ["leads", "listings"] as const;
export type TableKey = (typeof TABLE_KEYS)[number];

export const isTableKey = (k: string): k is TableKey =>
  (TABLE_KEYS as readonly string[]).includes(k);

/** How one cell is painted, when it is painted at all.

    A column carrying a category returns one of these and the grid puts it on
    the `<td>`:

      hue       a CSS custom property holding a colour, mixed into the surface
                by .cell-wash so it re-tints against whatever surface it lands
                on. Use this once our lookup tables carry a colour of their own.
      className a literal class, for the fixed semantic fills (an SLA state, a
                gate outcome) that are not a lookup row at all — see FILL in
                components/ui/SheetTable.tsx.

    We currently paint via `className` only: our lookup tables (`lead_status`,
    `pipeline_stage`, `listing_status`, …) hold a `name` and nothing else, so
    there is no colour to read. `hue` is kept wired so that adding a `color`
    column later is a change to lib/tables/fills.ts and nothing else. */
export interface CellFill {
  hue?: string;
  className?: string;
}

/* ---- typing a new row ----------------------------------------------------
   Deliberately OPT-IN PER COLUMN. SheetTable's rule is that there is no
   in-cell editing of EXISTING rows — an accidental drag on a phone must not
   rewrite a lead. The draft row is the exception, because nothing is being
   overwritten: it is a record that does not exist yet, and every keystroke is
   deliberate.

   A column can be typed into only if it declares an `add`. A computed figure,
   a photo, or a relation needing a dedupe check has no honest inline editor,
   so it does not get one — those are filled after the row exists. */

export type CellEditor =
  | { as: "text" }
  | { as: "number"; min?: number; max?: number }
  /** Thai-grouped money. Stored as typed; the caller parses. */
  | { as: "money" }
  | { as: "date" }
  | { as: "select"; choices: { value: string; label: string }[] }
  | { as: "bool" };

export interface NewRowField {
  /** Key this column's value takes in the draft handed to `onCreate`. */
  field: string;
  editor: CellEditor;
  /** The draft cannot be committed without it. A required field whose column
      is hidden would make the row uncompletable, so `resolve` refuses to hide
      it. */
  required?: boolean;
  /** Value the draft resets to. Use for a date defaulting to today. */
  initial?: string;
  placeholder?: string;
}

export interface SheetColumn<T> {
  key: string;
  label: string;
  /** Present = this column can be typed into on the draft row at the bottom. */
  add?: NewRowField;
  /** The identity column: frozen to the left, never hideable, never filled.
      Exactly one per table — a row with nothing to name it is not a row. */
  locked?: boolean;
  /** Numbers and dates line up right; words do not. `center` is for one-glyph
      columns (a grade letter, a tick) where a solid fill would otherwise read
      as a colour bar with something stuck to its left edge. */
  align?: "right" | "center";
  /** Minimum width in px. Prose columns need one or they collapse to the
      widest word; short ones are better left to the browser. */
  width?: number;
  cell: (row: T) => ReactNode;
  fill?: (row: T) => CellFill | undefined;
}

/** What one person has decided about one grid. Both lists are advisory. */
export interface TablePrefs {
  order: string[];
  hidden: string[];
}

export const EMPTY_PREFS: TablePrefs = { order: [], hidden: [] };

/** Every grid's prefs for one person, keyed by table. Absent = untouched. */
export type TablePrefsMap = Partial<Record<TableKey, TablePrefs>>;

/** The registry, re-ordered and filtered by a person's saved preference.

    Four rules, each because the alternative breaks on a release rather than
    in testing:

      1. A saved key the registry no longer has is DROPPED. Otherwise a column
         retired in code renders as a permanently blank strip for everyone who
         opened the manager once.
      2. A registry key the saved order does not mention is APPENDED, visible,
         in registry order. Otherwise a column shipped in a new release is
         invisible to exactly the people who use the feature most, and reads
         as "it wasn't built".
      3. The locked column is forced to the front and forced visible, whatever
         the stored arrays say. It is the row's identity and the frozen left
         edge; a stale tab must not be able to post it away.
      4. A column carrying a REQUIRED new-row field is forced visible too.
         Hiding it would leave the draft row permanently uncommittable with no
         way to see why. Hiding an optional one is fine: it just is not
         offered on the draft row. */
export function resolve<T>(registry: SheetColumn<T>[], prefs: TablePrefs | undefined): {
  ordered: SheetColumn<T>[];
  visible: SheetColumn<T>[];
} {
  const byKey = new Map(registry.map((c) => [c.key, c]));
  const seen = new Set<string>();
  const ordered: SheetColumn<T>[] = [];

  for (const key of prefs?.order ?? []) {
    const col = byKey.get(key);
    if (!col || seen.has(key)) continue;         // rule 1 (and a duplicated key)
    seen.add(key);
    ordered.push(col);
  }
  for (const col of registry) {                  // rule 2
    if (seen.has(col.key)) continue;
    seen.add(col.key);
    ordered.push(col);
  }

  // rule 3
  const lockedAt = ordered.findIndex((c) => c.locked);
  if (lockedAt > 0) ordered.unshift(...ordered.splice(lockedAt, 1));

  const hidden = new Set(prefs?.hidden ?? []);
  return {
    ordered,
    visible: ordered.filter((c) => c.locked || c.add?.required || !hidden.has(c.key)),
  };
}

/** Normalise what a client sends before it is stored. Same filtering as
    `resolve`, applied on the WRITE side too, so the stored row never contains
    a key the app cannot explain — a stale tab and a hand-rolled request are
    the same case. */
export function sanitize(
  knownKeys: string[],
  lockedKey: string | undefined,
  input: TablePrefs,
): TablePrefs {
  const known = new Set(knownKeys);
  const order: string[] = [];
  const seen = new Set<string>();
  for (const k of input.order) {
    if (!known.has(k) || seen.has(k)) continue;
    seen.add(k);
    order.push(k);
  }
  const hidden = [...new Set(input.hidden.filter((k) => known.has(k) && k !== lockedKey))];
  return { order, hidden };
}

/** Keys the column manager must never let a person hide: the identity column
    and anything the draft row cannot be committed without. Kept here rather
    than in the component so `resolve` (read) and the manager (write) cannot
    disagree about which those are. */
export function unhideable<T>(columns: SheetColumn<T>[]): Set<string> {
  return new Set(columns.filter((c) => c.locked || c.add?.required).map((c) => c.key));
}
