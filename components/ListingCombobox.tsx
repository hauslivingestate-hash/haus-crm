"use client";

/* The listing picker — search by code or project name, pick one.
 *
 * Lifted out of LeadForm on 2026-09-10, unchanged, when the lead drawer needed the same
 * control to add ทรัพย์ที่สนใจ to an existing lead. Copying it would have meant two pickers
 * drifting apart, and this one already handles the parts that are easy to get wrong:
 * debounced search, a stale-response guard, click-outside to close, and Enter to accept a
 * raw code for a listing the search has not indexed yet.
 *
 * `field` is duplicated from LeadForm deliberately — it is three utility classes, and
 * exporting a style constant across components to save nine words is a worse dependency
 * than the words. */

import * as React from "react";
import { Search } from "lucide-react";
import { searchListings, type ListingHit } from "@/lib/search";
import { cn } from "@/lib/cn";

const field =
  "w-full h-9 px-3 rounded-md border border-border-strong bg-surface text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

export function ListingCombobox({ value, onPick, placeholder }: {
  /** The currently chosen code, shown when the box is not being typed in. "" for none. */
  value: string;
  /** `sale` is the listing's agent, so the caller can default a lead's owner to them. */
  onPick: (code: string, sale?: string | null) => void;
  placeholder?: string;
}) {
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [matches, setMatches] = React.useState<ListingHit[]>([]);
  const [loading, setLoading] = React.useState(false);
  const boxRef = React.useRef<HTMLDivElement>(null);

  const query = q.trim();
  const display = value;

  // Debounced so typing a code doesn't fire a request per keystroke. The guard on `stale`
  // keeps an earlier, slower response from overwriting a later one.
  React.useEffect(() => {
    if (!open) return;
    let stale = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const hits = await searchListings(query);
      if (!stale) {
        setMatches(hits);
        setLoading(false);
      }
    }, 250);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [q, open, query]);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const pick = (code: string, sale?: string | null) => {
    onPick(code, sale);
    setQ("");
    setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search size={14} strokeWidth={1.75} className="text-text-subtle absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          value={open ? q : display}
          onChange={(e) => {
            setQ(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && q.trim()) {
              e.preventDefault();
              pick(q.trim().toUpperCase());
            }
          }}
          placeholder={placeholder ?? "ค้นหารหัส / ชื่อทรัพย์ หรือพิมพ์รหัส…"}
          className={cn(field, "pl-8")}
        />
      </div>
      {open && (
        <div className="absolute z-10 left-0 right-0 mt-1 rounded-md border border-border bg-surface shadow-pop max-h-56 overflow-y-auto">
          {value && (
            <button type="button" onClick={() => pick("")} className="w-full text-left px-3 py-2 text-small text-text-subtle hover:bg-surface-hover">
              — ล้าง —
            </button>
          )}
          {matches.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => pick(l.code, l.sale)}
              className="w-full text-left px-3 py-2 hover:bg-surface-hover flex items-center justify-between gap-2"
            >
              <span className="min-w-0 truncate">
                <span className="num text-small font-medium">{l.code}</span> <span className="text-small text-text-muted">{l.label}</span>
              </span>
              <span className="text-label text-text-subtle shrink-0">{l.sale ?? "—"}</span>
            </button>
          ))}
          {loading && matches.length === 0 && (
            <div className="px-3 py-2 text-small text-text-subtle">กำลังค้นหา…</div>
          )}
          {!loading && query && matches.length === 0 && (
            <button type="button" onClick={() => pick(q.trim().toUpperCase())} className="w-full text-left px-3 py-2 text-small text-accent hover:bg-accent-wash">
              ใช้รหัส “{q.trim().toUpperCase()}”
            </button>
          )}
        </div>
      )}
    </div>
  );
}
