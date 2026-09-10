"use client";

/* The Sheets-style grid. Ported from the Klaichan CRM (Ben, 2026-09-06).

   WHAT MAKES IT "LIKE GOOGLE SHEETS", and why each part is not decoration:

     every cell bordered   Our old table (components/ui/Table) drew row
                           dividers only, so the eye tracked rows fine and
                           columns not at all. At 8 columns that was
                           survivable; listings carries ~40 and that is the
                           whole problem. A lattice is what lets you read DOWN.
     30px rows             From 44 (Table.tsx's `h-11`). Fourteen rows in the
                           height that used to show nine.
     frozen header + id    Scroll to column 20 and you still know which row
                           and which field. Without it a wide grid is a maze.
     conditional FILLS     The cell wears the colour, not a chip inside it —
                           which is what a property agent already reads in
                           their own spreadsheet.
     column manager        Drag to reorder, tick to hide, saved per person.

   WHAT IT IS NOT. There is no in-cell editing of existing rows and no
   click-header-to-sort. Each is its own piece of work with its own failure
   modes (an accidental edit on a phone; a sort that disagrees with the filter
   row above it). Rows open the existing detail sheet, so this stays a way IN
   to a record rather than a second place to change one.

   The registry lives with each browser (LeadsBrowser, ListingsBrowser) — this
   file knows how to paint a grid and nothing about leads or listings. */

import { useMemo, useRef, useState, useTransition } from "react";
import { Columns3, RotateCcw, GripVertical, Lock, Check, Plus, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/Card";
import { resolve, unhideable, type CellEditor, type SheetColumn, type TablePrefs } from "@/lib/tables";
import { saveTablePrefs, resetTablePrefs } from "@/lib/tables/actions";

export function SheetTable<T>({
  tableKey, columns, rows, rowKey, onSelect, onHover, prefs, empty, caption, rowNumbers = true,
  onCreate, addHint,
}: {
  tableKey: string;
  columns: SheetColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Omit for a grid whose rows are not records. Rows then lose their pointer
      cursor too, so the grid never offers a click it will not answer. */
  onSelect?: (row: T) => void;
  /** Fired when a row is pointed at, once per entry. Used to start fetching the record
      the user is probably about to open — by the time the click lands the answer is
      often already in the router's cache, which is the difference between a drawer that
      appears and one that has to be waited for. Pointer only; a phone has no hover, so
      touch still pays the round trip. */
  onHover?: (row: T) => void;
  /** What this person saved last time; undefined = never opened the manager. */
  prefs?: TablePrefs;
  empty: string;
  /** Sits next to the column button — "แสดง 14 จาก 210". */
  caption?: string;
  /** The 1,2,3… gutter. On a record list it is the count made visible; on a
      grid whose first column already names the row it numbers nothing and
      reads as a column of noise. */
  rowNumbers?: boolean;
  /** Present = the grid grows a draft row under the last record, typed into
      directly. Resolves when the record exists; throwing keeps the draft on
      screen with its values intact, because a create that failed must not
      also lose what was typed. */
  onCreate?: (draft: Record<string, string>) => Promise<void>;
  /** One line under the draft row — where the fields it cannot take are
      filled in. */
  addHint?: string;
}) {
  /* The saved layout is seeded from the server and then owned here. The
     manager has to feel instant (it is a checkbox), so this is the truth for
     the rest of the session and the write is fire-and-forget. */
  const [local, setLocal] = useState<TablePrefs>(() => ({
    order: prefs?.order ?? [],
    hidden: prefs?.hidden ?? [],
  }));
  const [managing, setManaging] = useState(false);
  const [, startSave] = useTransition();

  const { ordered, visible } = useMemo(() => resolve(columns, local), [columns, local]);
  const lockedKey = useMemo(() => columns.find((c) => c.locked)?.key, [columns]);
  const knownKeys = useMemo(() => columns.map((c) => c.key), [columns]);
  const pinned = useMemo(() => unhideable(columns), [columns]);

  const persist = (next: TablePrefs) => {
    setLocal(next);
    /* Always store the FULL resolved order, not the fragment that was dragged:
       a partial order plus a later release's new column would otherwise
       reshuffle silently the next time the page loaded. */
    startSave(async () => {
      try {
        await saveTablePrefs(tableKey, next, knownKeys, lockedKey);
      } catch {
        /* A layout that failed to save is not worth an error banner over the
           grid — the columns are already where they were put for this session,
           and the next change tries again. */
      }
    });
  };

  const move = (from: string, to: string) => {
    const keys = ordered.map((c) => c.key);
    const a = keys.indexOf(from);
    const b = keys.indexOf(to);
    if (a < 0 || b < 0 || a === b) return;
    keys.splice(b, 0, ...keys.splice(a, 1));
    persist({ ...local, order: keys });
  };

  const toggle = (key: string) => {
    const hidden = local.hidden.includes(key)
      ? local.hidden.filter((k) => k !== key)
      : [...local.hidden, key];
    // Store the resolved order alongside, so the first thing anyone ever does
    // (hiding a column) also pins the order they were looking at.
    persist({ order: ordered.map((c) => c.key), hidden });
  };

  /* ---- the draft row ----
     Its values live here rather than in each cell so Enter can commit from any
     field, and so a failed create keeps everything typed. */
  const addFields = useMemo(
    // The column's LABEL travels with the field so "ยังกรอกไม่ครบ" can name
    // the column on screen, not an internal field key.
    () => visible.filter((c) => c.add).map((c) => ({ key: c.key, label: c.label, ...c.add! })),
    [visible],
  );
  const blank = useMemo(
    () => Object.fromEntries(addFields.map((f) => [f.field, f.initial ?? ""])),
    [addFields],
  );
  const [draft, setDraft] = useState<Record<string, string>>(blank);
  const [adding, startAdd] = useTransition();
  const [addError, setAddError] = useState<string | null>(null);

  const missing = addFields.filter((f) => f.required && !(draft[f.field] ?? "").trim());
  const touched = addFields.some((f) => (draft[f.field] ?? "") !== (f.initial ?? ""));

  const commit = () => {
    if (!onCreate || adding || missing.length) return;
    setAddError(null);
    startAdd(async () => {
      try {
        /* Only the fields currently ON the draft row are sent. `draft` is keyed
           by field and survives a column being hidden, so without this a value
           typed into an optional column and then hidden would still be
           submitted — the row would carry something nobody can see on it.
           Required add-columns cannot be hidden at all (resolve, rule 4), so
           this can never drop something the create needs. */
        await onCreate(Object.fromEntries(
          addFields.map((f) => [f.field, draft[f.field] ?? ""]),
        ));
        setDraft(blank);          // ready for the next one, Sheets-style
      } catch (e) {
        setAddError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
      }
    });
  };

  const reset = () => {
    setLocal({ order: [], hidden: [] });
    startSave(async () => {
      try { await resetTablePrefs(tableKey); } catch { /* see persist */ }
    });
  };

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border px-4 py-2.5">
        <span className="num text-[0.72rem] text-text-subtle">{caption}</span>
        <button
          onClick={() => setManaging((v) => !v)}
          aria-expanded={managing}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[0.75rem] font-medium transition-colors",
            managing
              ? "border-accent bg-accent-wash text-accent"
              : "border-border-strong text-text-muted hover:border-accent hover:text-accent",
          )}
        >
          <Columns3 size={13} /> คอลัมน์
          <span className="num text-[0.7rem] text-text-subtle">{visible.length}/{columns.length}</span>
        </button>
      </div>

      {managing && (
        <ColumnManager
          columns={ordered}
          hidden={local.hidden}
          pinned={pinned}
          onToggle={toggle}
          onMove={move}
          onReset={reset}
        />
      )}

      {/* An empty grid still renders the table WHEN IT CAN BE ADDED TO — the
          moment you most need the draft row is when there is nothing there
          yet, and a placeholder that replaces the whole grid takes it away. */}
      {rows.length === 0 && !onCreate ? (
        <div className="grid place-items-center py-12 text-[0.8rem] text-text-subtle">{empty}</div>
      ) : (
        /* max-h keeps the sticky header meaningful: without a scroll container
           of its own the header would only stick to the window, and the filter
           row above would slide out from under it. */
        <div className={cn(
          "overflow-auto overscroll-contain scroll-thin",
          rows.length === 0 ? "max-h-none" : "max-h-[calc(100vh-16rem)] min-h-[12rem]",
        )}>
          <table className="w-full border-separate border-spacing-0 whitespace-nowrap text-[0.78rem] leading-[1.35]">
            <thead>
              <tr>
                {rowNumbers && (
                  <th className={cn(HEAD, "sticky left-0 z-40 w-[42px] min-w-[42px] px-1.5 text-right")} />
                )}
                {visible.map((c, i) => (
                  <th
                    key={c.key}
                    scope="col"
                    style={c.width ? { minWidth: c.width } : undefined}
                    className={cn(
                      HEAD,
                      // The identity column freezes flush against the gutter,
                      // so its offset is exactly the gutter's width — or zero
                      // when there is no gutter.
                      i === 0 && (rowNumbers ? "sticky left-[42px] z-40" : "sticky left-0 z-40"),
                      i === 0 && "border-r-border-strong",
                      c.align === "right" && "text-right",
                      c.align === "center" && "text-center",
                    )}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr
                  key={rowKey(row)}
                  onClick={onSelect && (() => onSelect(row))}
                  onPointerEnter={onHover && (() => onHover(row))}
                  className={cn("group", onSelect && "cursor-pointer")}
                >
                  {rowNumbers && (
                    <td className={cn(CELL, "sticky left-0 z-20 bg-surface text-right", NUMCOL)}>{ri + 1}</td>
                  )}
                  {visible.map((c, i) => {
                    const f = c.fill?.(row);
                    return (
                      <td
                        key={c.key}
                        style={f?.hue ? ({ "--wash-hue": f.hue } as React.CSSProperties) : undefined}
                        className={cn(
                          CELL,
                          // The identity column is frozen, so it must stay
                          // opaque — a tint here would let the columns
                          // scrolling beneath it show through.
                          i === 0
                            ? cn(
                                "sticky z-20 border-r-border-strong bg-surface font-medium",
                                rowNumbers ? "left-[42px]" : "left-0",
                              )
                            : f?.hue
                              ? "cell-wash font-medium"
                              : f?.className
                                ? cn("font-medium", f.className)
                                : "bg-surface",
                          c.align === "right" && "text-right",
                          c.align === "center" && "text-center",
                        )}
                      >
                        {c.cell(row)}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* THE DRAFT ROW. Last row of the body rather than a separate
                  pinned strip: it has to scroll horizontally in lockstep with
                  the header and the records above it, and a second table would
                  drift out of alignment the moment a column resized. */}
              {onCreate && (
                <tr className="group/add bg-surface-2">
                  {rowNumbers && (
                    <td className={cn(CELL, "sticky left-0 z-20 bg-surface-2 text-center", NUMCOL)}>
                      <button
                        type="button"
                        onClick={commit}
                        disabled={adding || missing.length > 0}
                        title={missing.length
                          ? `ยังกรอกไม่ครบ: ${missing.map((f) => f.label).join(", ")}`
                          : "เพิ่มแถวนี้"}
                        aria-label="เพิ่มแถวใหม่"
                        className="grid h-5 w-5 place-items-center rounded text-accent transition-opacity disabled:opacity-30"
                      >
                        {adding
                          ? <LoaderCircle size={12} className="animate-spin" />
                          : <Plus size={13} />}
                      </button>
                    </td>
                  )}
                  {visible.map((c, i) => (
                    <td
                      key={c.key}
                      className={cn(
                        CELL, "p-0",
                        i === 0 && cn(
                          "sticky z-20 border-r-border-strong bg-surface-2",
                          rowNumbers ? "left-[42px]" : "left-0",
                        ),
                        i !== 0 && "bg-surface-2",
                      )}
                    >
                      {c.add ? (
                        <DraftCell
                          field={c.add.field}
                          editor={c.add.editor}
                          placeholder={c.add.placeholder ?? (i === 0 ? "เพิ่มแถวใหม่…" : "")}
                          align={c.align}
                          value={draft[c.add.field] ?? ""}
                          onChange={(v) => setDraft((d) => ({ ...d, [c.add!.field]: v }))}
                          onCommit={commit}
                        />
                      ) : (
                        <span className="block px-2.5 text-text-subtle">–</span>
                      )}
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {onCreate && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border px-4 py-2 text-[0.72rem]">
          {rows.length === 0 && !addError
            ? <span className="text-text-subtle">{empty} — พิมพ์ในแถวด้านบนเพื่อเพิ่มรายการแรก</span>
            : addError
            ? <span className="text-red">{addError}</span>
            : missing.length && touched
              ? <span className="text-amber">ยังกรอกไม่ครบ: {missing.map((f) => f.label).join(" · ")}</span>
              : <span className="text-text-subtle">พิมพ์ในแถวล่างสุดแล้วกด Enter เพื่อเพิ่ม</span>}
          {addHint && <span className="text-text-subtle">· {addHint}</span>}
        </div>
      )}
    </Card>
  );
}

/* One editable cell on the draft row. Deliberately unstyled to the eye — no
   border, transparent ground — so the row reads as part of the grid rather
   than as a form that landed on top of it, which is the whole feel of typing
   into a spreadsheet. The focus ring is the only affordance, and it is enough
   because the row already sits on `surface-2`.

   Enter commits from ANY cell. That is the interaction people actually have
   with a spreadsheet row; hunting for a save button after typing four fields
   is what makes an inline row feel slower than the form it replaced. */
function DraftCell({ field, editor, placeholder, align, value, onChange, onCommit }: {
  field: string;
  editor: CellEditor;
  placeholder?: string;
  align?: "right" | "center";
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
}) {
  const base = cn(
    "h-[28px] w-full min-w-0 border-0 bg-transparent px-2.5 text-[0.78rem] outline-none",
    "placeholder:text-text-subtle focus:bg-surface focus:ring-2 focus:ring-inset focus:ring-ring/40",
    align === "right" && "text-right",
    align === "center" && "text-center",
  );
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); onCommit(); }
  };

  if (editor.as === "bool") {
    return (
      <span className="grid h-[28px] place-items-center">
        <input
          type="checkbox"
          aria-label={field}
          checked={value === "1"}
          onChange={(e) => onChange(e.target.checked ? "1" : "")}
          onKeyDown={onKey}
          className="h-3.5 w-3.5 accent-[var(--accent)]"
        />
      </span>
    );
  }

  if (editor.as === "select") {
    return (
      <select
        aria-label={field}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKey}
        className={cn(base, "appearance-none", !value && "text-text-subtle")}
      >
        <option value="">{placeholder || "—"}</option>
        {editor.choices.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }

  const numeric = editor.as === "number" || editor.as === "money";
  return (
    <input
      aria-label={field}
      type={editor.as === "date" ? "date" : "text"}
      inputMode={numeric ? "decimal" : undefined}
      value={value}
      placeholder={placeholder}
      min={editor.as === "number" ? editor.min : undefined}
      onChange={(e) => onChange(
        // Money and counts are typed, not pasted from a form — strip anything
        // that cannot be part of a number rather than rejecting on submit,
        // which would fail after four more fields were filled in.
        numeric ? e.target.value.replace(/[^\d.,-]/g, "") : e.target.value,
      )}
      onKeyDown={onKey}
      className={cn(base, numeric && "num")}
    />
  );
}

/* Shared cell metrics. `h-[30px]` with no vertical padding rather than
   padding-driven height, so every row is exactly the same height whatever a
   cell contains — a two-line cell in a dense grid breaks the lattice the whole
   design rests on, and truncation is the honest fix. */
const CELL =
  "h-[30px] max-w-[18rem] truncate border-b border-r border-border px-2.5 align-middle " +
  // Hover tints OVER the cell's own fill instead of replacing it: a background
  // swap would erase the conditional colour at the exact moment the cursor is
  // on it. An inset shadow composites; background-color does not.
  "group-hover:shadow-[inset_0_0_0_999px_var(--surface-hover)]";

const HEAD =
  "sticky top-0 z-30 h-[30px] whitespace-nowrap border-b border-r border-border-strong bg-surface-3 " +
  "px-2.5 text-left align-middle text-[0.7rem] font-semibold text-text-muted";

const NUMCOL = "num w-[42px] min-w-[42px] px-1.5 text-[0.68rem] text-text-subtle";

/* ---------- the column manager ------------------------------------------- */

/** Drag to reorder, tick to show. Native HTML5 drag rather than a library:
    this is one list of one-line rows, and the app has no other drag surface to
    share a dependency with.

    The locked column is rendered but inert — showing it greyed says "this one
    is the row's name" far better than leaving a gap where it should be. */
function ColumnManager<T>({
  columns, hidden, pinned, onToggle, onMove, onReset,
}: {
  columns: SheetColumn<T>[];
  hidden: string[];
  /** Cannot be hidden: the identity column, and anything the draft row needs. */
  pinned: Set<string>;
  onToggle: (key: string) => void;
  onMove: (from: string, to: string) => void;
  onReset: () => void;
}) {
  const dragged = useRef<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  return (
    <div className="border-b border-border bg-surface-2 px-4 py-3">
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-[0.78rem] font-semibold">จัดการคอลัมน์</span>
        <span className="text-[0.72rem] text-text-subtle">
          ลากเพื่อสลับลำดับ · ติ๊กเพื่อแสดง/ซ่อน · <b className="font-medium text-green">จำไว้เฉพาะบัญชีคุณ</b>
        </span>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-1.5">
        {columns.map((c) => {
          const off = hidden.includes(c.key);
          const fixed = pinned.has(c.key);
          return (
            <div
              key={c.key}
              draggable={!c.locked}
              onDragStart={() => { dragged.current = c.key; }}
              onDragEnd={() => { dragged.current = null; setOver(null); }}
              onDragOver={(e) => {
                if (!dragged.current || c.locked) return;
                e.preventDefault();
                setOver(c.key);
              }}
              onDragLeave={() => setOver((k) => (k === c.key ? null : k))}
              onDrop={(e) => {
                e.preventDefault();
                if (dragged.current && !c.locked) onMove(dragged.current, c.key);
                dragged.current = null;
                setOver(null);
              }}
              className={cn(
                "flex items-center gap-2 rounded-lg border bg-surface px-2 py-1.5 text-[0.76rem] transition-colors",
                fixed ? "cursor-default opacity-70" : "cursor-grab active:cursor-grabbing",
                over === c.key ? "border-accent bg-accent-wash" : "border-border hover:border-border-strong",
              )}
            >
              {fixed
                ? <Lock size={11} className="shrink-0 text-text-subtle" />
                : <GripVertical size={12} className="shrink-0 text-text-subtle" />}
              <label className={cn("flex min-w-0 flex-1 items-center gap-2", !fixed && "cursor-pointer")}>
                <input
                  type="checkbox"
                  checked={fixed || !off}
                  disabled={fixed}
                  onChange={() => onToggle(c.key)}
                  className="h-3 w-3 shrink-0 accent-[var(--accent)]"
                />
                <span className="truncate">{c.label}</span>
              </label>
              {fixed && (
                <span className="shrink-0 text-[0.65rem] text-text-subtle">
                  {c.locked ? "ตรึง" : "จำเป็น"}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={onReset}
        className="mt-2.5 inline-flex items-center gap-1.5 text-[0.74rem] font-medium text-accent hover:underline"
      >
        <RotateCcw size={12} /> คืนค่าเริ่มต้น
      </button>
    </div>
  );
}

/* ---------- cell helpers, shared by both registries ---------------------- */

/** A value that may be missing. Every registry uses this rather than `|| "—"`
    so an empty cell looks the same everywhere and 0 never reads as blank. */
export function Val({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  const empty = children == null || children === "" || children === "—";
  if (empty) return <span className="text-text-subtle">—</span>;
  return <span className={cn(mono && "num")}>{children}</span>;
}

/** Muted secondary text — prose columns that are context, not the answer. */
export function Dim({ children }: { children: React.ReactNode }) {
  const empty = children == null || children === "" || children === "—";
  if (empty) return <span className="text-text-subtle">—</span>;
  return <span className="text-text-muted">{children}</span>;
}

/** Fixed semantic fills, for columns that carry no colour of their own.

    Our lookup tables (`lead_status`, `pipeline_stage`, …) hold a `name` and
    nothing else, so every fill today comes from here via lib/tables/fills.ts.
    When those tables gain a `color`, registries switch to `{ hue }` and this
    stays for the genuinely fixed cases (an SLA state, a gate outcome). */
export const FILL = {
  ok:   { className: "bg-green-bg" },
  warn: { className: "bg-amber-bg" },
  bad:  { className: "bg-red-bg" },
  info: { className: "bg-blue-bg" },
  mute: { className: "bg-surface-3 text-text-muted" },
} as const;

/** Check mark used by boolean columns — a tick reads faster than "ใช่". */
export function Yes({ on }: { on: boolean | undefined }) {
  return on
    ? <Check size={13} className="text-green" aria-label="ใช่" />
    : <span className="text-text-subtle">—</span>;
}
