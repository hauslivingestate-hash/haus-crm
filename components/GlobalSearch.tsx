"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Building2,
  CornerDownLeft,
  Landmark,
  Loader2,
  Search,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useTopmostEscape } from "@/lib/overlayStack";
import { searchAll, type SearchGroup, type SearchHit, type SearchKind } from "@/lib/search";

/* ⌘K — one box that finds a lead, a listing, a project or a person.
 *
 * ── A PALETTE, NOT A RESULTS PAGE ───────────────────────────────────────────────
 * Every hit is a record with its own page, so the answer to a search is "open it", not
 * "here is a list". A panel over the current page does that in one keystroke and leaves
 * the page underneath exactly as it was. A /search route would add a page nobody wants
 * to be on.
 *
 * ── PORTALED TO <body> ──────────────────────────────────────────────────────────
 * The topbar is `backdrop-blur`, and a backdrop filter makes its element the containing
 * block for `position: fixed` descendants. Rendered in place, the panel would be clipped
 * to a 56px strip. Same reason the edit sheets portal out.
 *
 * ── SEARCH RUNS ON THE SERVER ───────────────────────────────────────────────────
 * `searchAll` is a server action: the tables stay on the server, RLS scopes the rows, and
 * the nav's own permissions decide which groups are even queried (lib/search).
 */

const KIND_ICON: Record<SearchKind, LucideIcon> = {
  lead: UserRound,
  listing: Building2,
  project: Landmark,
  person: Users,
};

/** Typing pause before a request. Long enough to skip the keystrokes in the middle of a
    word, short enough that the panel never feels like it is waiting for permission. */
const DEBOUNCE_MS = 180;

export function GlobalSearch() {
  const [open, setOpen] = React.useState(false);
  // "⌘K" is a lie on a PC keyboard. Decided after mount — `navigator` is not on the server.
  const [mac, setMac] = React.useState(true);
  React.useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.platform));
  }, []);

  // The shortcut works from anywhere in the app, including inside another input: a
  // person mid-form who wants to look something up should not have to click out first.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {/* Desktop: a box that looks like a search field and opens the palette. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="ค้นหา"
        aria-keyshortcuts={mac ? "Meta+K" : "Control+K"}
        className="hidden h-9 w-56 items-center gap-2 rounded-md border border-border bg-surface-2 px-2.5 text-small text-text-subtle transition-colors hover:border-border-strong hover:text-text-muted md:flex"
      >
        <Search size={15} strokeWidth={1.75} className="shrink-0" />
        <span className="flex-1 text-left">ค้นหา…</span>
        <kbd className="rounded border border-border bg-surface px-1 font-sans text-label text-text-subtle">
          {mac ? "⌘K" : "Ctrl K"}
        </kbd>
      </button>
      {/* Phone: an icon in the cluster. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="ค้นหา"
        className="grid size-9 place-items-center rounded-md text-text-muted transition-colors hover:bg-surface-hover hover:text-text md:hidden"
      >
        <Search size={18} strokeWidth={1.75} />
      </button>
      {open && <Palette onClose={() => setOpen(false)} />}
    </>
  );
}

function Palette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [groups, setGroups] = React.useState<SearchGroup[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [cursor, setCursor] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);
  /* Stale-response guard. A slow answer for "so" must not land after the answer for
     "somchai" and replace it. Each request takes a number; only the newest may write. */
  const seq = React.useRef(0);

  useTopmostEscape(onClose);

  React.useEffect(() => {
    const query = q.trim();
    if (!query) {
      seq.current++;
      setGroups([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const id = ++seq.current;
    const t = window.setTimeout(async () => {
      try {
        const res = await searchAll(query);
        if (id !== seq.current) return;
        setGroups(res);
        setCursor(0);
      } catch {
        if (id === seq.current) setGroups([]);
      } finally {
        if (id === seq.current) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [q]);

  const flat = React.useMemo(() => groups.flatMap((g) => g.hits), [groups]);

  // Keep the highlighted row on screen while arrowing through a long list.
  React.useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${cursor}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const go = (hit: SearchHit) => {
    onClose();
    router.push(hit.href);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, Math.max(flat.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      const hit = flat[cursor];
      if (hit) {
        e.preventDefault();
        go(hit);
      }
    }
  };

  const query = q.trim();
  const activeId = flat[cursor] ? `gs-${flat[cursor].kind}-${flat[cursor].id}` : undefined;

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[12vh]"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="ค้นหา"
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-xl flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-pop"
      >
        <div className="flex items-center gap-2.5 border-b border-border px-3.5">
          <Search size={17} strokeWidth={1.75} className="shrink-0 text-text-subtle" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="ค้นหาลีด ทรัพย์ โครงการ หรือคน…"
            role="combobox"
            aria-expanded={flat.length > 0}
            aria-controls="global-search-list"
            aria-activedescendant={activeId}
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck={false}
            className="h-12 min-w-0 flex-1 bg-transparent text-body text-text placeholder:text-text-subtle focus:outline-none"
          />
          {loading && (
            <Loader2 size={16} strokeWidth={1.75} className="shrink-0 animate-spin text-text-subtle" />
          )}
        </div>

        <div
          ref={listRef}
          id="global-search-list"
          role="listbox"
          className="max-h-[60vh] overflow-y-auto py-1.5"
        >
          {!query ? (
            <p className="px-3.5 py-6 text-center text-small text-text-subtle">
              พิมพ์ชื่อ เบอร์โทร รหัส หรือชื่อโครงการ
            </p>
          ) : flat.length === 0 && !loading ? (
            <p className="px-3.5 py-6 text-center text-small text-text-subtle">
              ไม่พบ “{query}”
            </p>
          ) : (
            groups.map((g) => (
              <div key={g.kind}>
                <div className="px-3.5 pb-1 pt-2 text-label uppercase text-text-subtle">{g.title}</div>
                {g.hits.map((hit) => {
                  const i = flat.indexOf(hit);
                  const on = i === cursor;
                  const Icon = KIND_ICON[hit.kind];
                  return (
                    <button
                      key={`${hit.kind}-${hit.id}`}
                      id={`gs-${hit.kind}-${hit.id}`}
                      type="button"
                      role="option"
                      aria-selected={on}
                      data-index={i}
                      onMouseEnter={() => setCursor(i)}
                      onClick={() => go(hit)}
                      className={cn(
                        "flex h-11 w-full items-center gap-2.5 px-3.5 text-left transition-colors",
                        on ? "bg-accent-wash" : "hover:bg-surface-hover"
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-7 shrink-0 place-items-center rounded-md",
                          on ? "bg-surface text-accent" : "bg-surface-2 text-text-muted"
                        )}
                      >
                        <Icon size={15} strokeWidth={1.75} />
                      </span>
                      <span className="min-w-0 flex-1 leading-tight">
                        <span className="block truncate text-body text-text">{hit.label}</span>
                        {hit.detail && (
                          <span className="num block truncate text-label text-text-subtle">
                            {hit.detail}
                          </span>
                        )}
                      </span>
                      {on && (
                        <CornerDownLeft size={13} strokeWidth={1.75} className="shrink-0 text-text-subtle" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
