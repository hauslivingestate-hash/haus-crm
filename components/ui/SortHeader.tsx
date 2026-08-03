"use client";

import * as React from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { TH } from "./Table";
import type { SortDir } from "@/lib/sort";
import { cn } from "@/lib/cn";

export interface SortState {
  key: string;
  dir: SortDir;
}

/** Sort state + toggle. Same column re-click flips direction; a new column
 *  starts at its `defaultDir`. Empty initial key = natural (unsorted) order. */
export function useSort(initial: SortState = { key: "", dir: "asc" }) {
  const [sort, setSort] = React.useState<SortState>(initial);
  const onSort = React.useCallback((key: string, defaultDir: SortDir = "asc") => {
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: defaultDir }
    );
  }, []);
  return { sort, onSort };
}

/** A clickable table header that shows the active sort direction. */
export function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  align,
  defaultDir = "asc",
}: {
  label: React.ReactNode;
  sortKey: string;
  sort: SortState;
  onSort: (key: string, defaultDir: SortDir) => void;
  align?: "right";
  defaultDir?: SortDir;
}) {
  const active = sort.key === sortKey;
  return (
    <TH className={align === "right" ? "text-right" : undefined}>
      <button
        type="button"
        onClick={() => onSort(sortKey, defaultDir)}
        className={cn(
          "group -mx-1 px-1 inline-flex items-center gap-1 rounded transition-colors hover:text-text-muted",
          align === "right" && "flex-row-reverse",
          active && "text-text"
        )}
      >
        {label}
        <span className="shrink-0">
          {active ? (
            sort.dir === "asc" ? (
              <ChevronUp size={12} strokeWidth={2.25} />
            ) : (
              <ChevronDown size={12} strokeWidth={2.25} />
            )
          ) : (
            <ChevronsUpDown
              size={12}
              strokeWidth={2}
              className="opacity-30 group-hover:opacity-70 transition-opacity"
            />
          )}
        </span>
      </button>
    </TH>
  );
}
