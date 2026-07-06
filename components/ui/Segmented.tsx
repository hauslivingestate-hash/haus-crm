"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

export function Segmented({
  options,
  defaultValue,
  onChange,
}: {
  options: string[];
  defaultValue?: string;
  onChange?: (v: string) => void;
}) {
  const [active, setActive] = useState(defaultValue ?? options[0]);
  return (
    <div className="inline-flex items-center gap-0.5 bg-surface-2 rounded-md p-0.5">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => {
            setActive(o);
            onChange?.(o);
          }}
          className={cn(
            "h-7 px-3 rounded-[7px] text-small transition-colors",
            active === o
              ? "bg-surface text-text shadow-card"
              : "text-text-muted hover:text-text"
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
