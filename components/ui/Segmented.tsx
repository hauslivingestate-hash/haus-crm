"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

/* Pill segmented control — a grey track, one navy pill for the active item.
 *
 * TWO LAYERS. `SegmentedTrack` + `SegmentedItem` are the look and nothing else: no state,
 * no opinion about where the selection lives. The range bar keeps its selection in the
 * URL, the Close ⇄ Win toggle too, the theme row in next-themes — five controls that
 * used to carry five hand-copied class strings. `Segmented` below is the convenience
 * that owns its own state, for the plain case. */

type Size = "sm" | "md" | "icon";

export function SegmentedTrack({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("inline-flex shrink-0 items-center gap-0.5 rounded-full bg-surface-2 p-0.5", className)}
      {...props}
    />
  );
}

export function SegmentedItem({
  on,
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { on: boolean; size?: Size }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      className={cn(
        "whitespace-nowrap rounded-full transition-colors",
        size === "sm" && "h-6 px-2.5 text-small",
        size === "md" && "h-7 px-3 text-small",
        size === "icon" && "grid size-7 place-items-center",
        // text-surface, not text-white: navy lightens in dark mode and the ink on it has
        // to darken with the surface it was borrowed from.
        on ? "bg-navy font-medium text-surface shadow-card" : "text-text-muted hover:text-text",
        className
      )}
      {...props}
    />
  );
}

export function Segmented({
  options,
  defaultValue,
  onChange,
  size,
}: {
  options: string[];
  defaultValue?: string;
  onChange?: (v: string) => void;
  size?: Size;
}) {
  const [active, setActive] = useState(defaultValue ?? options[0]);
  return (
    <SegmentedTrack>
      {options.map((o) => (
        <SegmentedItem
          key={o}
          size={size}
          on={active === o}
          onClick={() => {
            setActive(o);
            onChange?.(o);
          }}
        >
          {o}
        </SegmentedItem>
      ))}
    </SegmentedTrack>
  );
}
