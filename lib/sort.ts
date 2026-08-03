// Small, reusable table-sort helpers. Categorical columns (potential, stage,
// status) sort by an explicit domain order, not alphabetically; numeric/text
// columns compare naturally. Null/empty values always sort last, either way.

export type SortDir = "asc" | "desc";

/** Position of `value` within `order`: known → its index, unknown → after all
 *  known values, null/empty → null (so it sorts last). */
export function orderIndex(
  order: readonly string[],
  value: string | null | undefined
): number | null {
  if (value == null || value === "") return null;
  const i = order.indexOf(value);
  return i === -1 ? order.length : i;
}

/** Comparator that keeps null/empty last regardless of direction. */
export function compareValues(
  a: number | string | null | undefined,
  b: number | string | null | undefined,
  dir: SortDir
): number {
  const aNull = a == null || a === "";
  const bNull = b == null || b === "";
  if (aNull && bNull) return 0;
  if (aNull) return 1;
  if (bNull) return -1;
  const cmp =
    typeof a === "number" && typeof b === "number"
      ? a - b
      : String(a).localeCompare(String(b), "th");
  return dir === "asc" ? cmp : -cmp;
}
