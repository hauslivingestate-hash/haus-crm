"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Search, Check, Sparkles, Download, Filter, X,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronsUpDown, ChevronUp, ChevronDown,
} from "lucide-react";
import type { CrmRow } from "@/lib/queries";
import { Card, CardContent } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { Input } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import { Avatar } from "@/components/ui/Avatar";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { StatusBadge, Dot } from "@/components/ui/Dot";
import { assignableAgents, defaultAssignee, sourceLabel } from "@/lib/leads";
import { useNewLeads } from "@/components/NewLeadsProvider";
import { useRbac } from "@/components/RbacProvider";
import { formatBaht, formatThaiDate } from "@/lib/format";
import { leadStatusDot } from "@/lib/status";
import { STAGES, stageMeta } from "@/lib/pipeline";
import { compareValues, orderIndex, type SortDir } from "@/lib/sort";
import { useSort } from "@/components/ui/SortHeader";
import { cn } from "@/lib/cn";

// Unified row for the admin management table — real leads (main_6_buyer_crm) + optimistic
// new leads from the intake FAB, sharing the provider's assignment overrides + audit trail.
interface Row {
  lead_id: string;
  lead_name: string;
  phone: string | null;
  type: string; // ประเภท label
  source: string | null; // ช่องทาง label
  listing_code: string | null;
  budgetBaht: number | null;
  stage: string | null;
  status: string | null;
  originalSale: string; // pre-override owner
  date: string | null;
  isNew: boolean;
}

const STAGE_KEYS: string[] = STAGES.map((s) => s.key);
const STATUS_ORDER = ["Active", "Win", "Lose", "Reject"];
const PAGE_SIZES = [25, 50, 100];

// ── Which columns support Google-Sheets-style value filtering, and how each row maps to a
//    canonical filter value (raw), plus the label shown in the filter menu. ─────────────
type FilterCol = "type" | "source" | "stage" | "status" | "assigned";

// NOTE (wiring): filtering + sorting + pagination run CLIENT-SIDE over the full row set here
// (design build reads main_6_buyer_crm read-only + merges optimistic new leads). At real scale
// (600 leads/mo → 10k+/yr) move these to the query: Supabase .ilike()/.eq() filters, .order()
// sort, .range() pagination, count:"exact" for the total. The UI/controls stay identical.
export function LeadAssignment({ leads }: { leads: CrmRow[] }) {
  const router = useRouter();
  const agents = assignableAgents();
  const { newLeads, assignments, assign } = useNewLeads();
  const { currentUser } = useRbac();
  const [q, setQ] = React.useState("");
  const [quick, setQuick] = React.useState<"all" | "unassigned">("all");
  const [colFilters, setColFilters] = React.useState<Partial<Record<FilterCol, string[]>>>({});
  const { sort, onSort } = useSort();
  const [pageSize, setPageSize] = React.useState(50);
  const [page, setPage] = React.useState(1);

  const rows: Row[] = React.useMemo(() => {
    const fromNew: Row[] = newLeads.map((l) => ({
      lead_id: l.lead_id,
      lead_name: l.lead_name,
      phone: l.phone,
      type: l.role === "owner" ? "เจ้าของ" : "ผู้ซื้อ/เช่า",
      source: sourceLabel(l.source),
      listing_code: l.listing_code || null,
      budgetBaht: l.budget ?? null,
      stage: "Lead",
      status: "Active",
      originalSale: l.sale_id ?? "",
      date: l.date_received,
      isNew: true,
    }));
    const fromReal: Row[] = leads.map((l) => ({
      lead_id: l.lead_id,
      lead_name: l.lead_name ?? l.lead_id,
      phone: l.phone,
      type: l.lead_type ?? "—",
      source: null, // main_6_buyer_crm has no source column yet
      listing_code: l.listing_code,
      budgetBaht: l.budget ?? null, // main_6_buyer_crm.budget is already in baht (matches /leads)
      stage: l.pipeline_stage,
      status: l.lead_status,
      originalSale: l.sale_id ?? "",
      date: l.date_received,
      isNew: false,
    }));
    return [...fromNew, ...fromReal];
  }, [newLeads, leads]);

  const effectiveSale = React.useCallback(
    (r: Row) => assignments[r.lead_id] ?? r.originalSale,
    [assignments]
  );

  // Canonical filter value for a row in a given column (raw value the filter matches on).
  const valueOf = React.useCallback(
    (r: Row, col: FilterCol): string => {
      switch (col) {
        case "type": return r.type || "";
        case "source": return r.source ?? "";
        case "stage": return r.stage ?? "";
        case "status": return r.status ?? "";
        case "assigned": return effectiveSale(r);
      }
    },
    [effectiveSale]
  );

  // ── Pipeline: search + quick filter → (base, drives filter option lists) → column
  //    filters → sort → (list, the full result) → page slice. ─────────────────────────
  const query = q.trim().toLowerCase();
  const base = React.useMemo(
    () =>
      rows
        .filter((r) => (quick === "all" ? true : !effectiveSale(r)))
        .filter(
          (r) =>
            !query ||
            r.lead_name.toLowerCase().includes(query) ||
            (r.phone ?? "").toLowerCase().includes(query) ||
            (r.listing_code ?? "").toLowerCase().includes(query)
        ),
    [rows, quick, query, effectiveSale]
  );

  const list = React.useMemo(() => {
    const filtered = base.filter((r) =>
      (Object.entries(colFilters) as [FilterCol, string[]][]).every(
        ([col, vals]) => !vals || vals.length === 0 || vals.includes(valueOf(r, col))
      )
    );
    const val = SORT_VALUE[sort.key];
    return val ? [...filtered].sort((a, b) => compareValues(val(a, effectiveSale), val(b, effectiveSale), sort.dir)) : filtered;
  }, [base, colFilters, sort, valueOf, effectiveSale]);

  // Distinct values + counts per filterable column (from `base`, so counts reflect the
  // current search/quick filter but stay stable as you toggle column filters).
  const optionsFor = React.useCallback(
    (col: FilterCol): { value: string; label: string; count: number }[] => {
      const counts = new Map<string, number>();
      for (const r of base) {
        const v = valueOf(r, col);
        counts.set(v, (counts.get(v) ?? 0) + 1);
      }
      const items = [...counts.entries()].map(([value, count]) => ({ value, label: labelFor(col, value), count }));
      if (col === "stage") return items.sort((a, b) => (STAGE_KEYS.indexOf(a.value) + 1 || 99) - (STAGE_KEYS.indexOf(b.value) + 1 || 99));
      if (col === "status") return items.sort((a, b) => (STATUS_ORDER.indexOf(a.value) + 1 || 99) - (STATUS_ORDER.indexOf(b.value) + 1 || 99));
      return items.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "th"));
    },
    [base, valueOf]
  );

  // Reset to page 1 whenever the result set changes shape.
  const filterSig = JSON.stringify(colFilters) + query + quick + pageSize;
  React.useEffect(() => setPage(1), [filterSig]);

  const total = list.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * pageSize;
  const pageRows = list.slice(start, start + pageSize);

  const unassignedCount = rows.filter((r) => !effectiveSale(r)).length;
  const assignedCount = rows.length - unassignedCount;
  const winCount = rows.filter((r) => r.status === "Win").length;
  const activeFilterCols = (Object.values(colFilters).filter((v) => v && v.length > 0)).length;

  const setFilter = (col: FilterCol, vals: string[]) =>
    setColFilters((f) => ({ ...f, [col]: vals }));
  const clearFilters = () => setColFilters({});

  // Client-side CSV export of ALL currently-filtered rows (not just the page) — the report path.
  const exportCsv = () => {
    const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const headers = ["Lead ID", "ลูกค้า", "เบอร์", "ประเภท", "ช่องทาง", "ทรัพย์ที่สนใจ", "งบ (฿)", "สเตจ", "สถานะ", "มอบหมายให้", "วันที่รับ"];
    const lines = [headers.map(cell).join(",")];
    for (const r of list) {
      lines.push([r.lead_id, r.lead_name, r.phone, r.type, r.source, r.listing_code, r.budgetBaht, r.stage, r.status, effectiveSale(r), r.date].map(cell).join(","));
    }
    // BOM so Excel reads the Thai UTF-8 correctly.
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lead-database.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const colHeader = (label: string, sortKey: string, col?: FilterCol, align?: "right", defaultDir: SortDir = "asc") => (
    <ColHeader
      label={label}
      sortKey={sortKey}
      sort={sort}
      onSort={onSort}
      align={align}
      defaultDir={defaultDir}
      filter={
        col
          ? {
              active: (colFilters[col]?.length ?? 0) > 0,
              items: optionsFor(col),
              selected: colFilters[col] ?? [],
              onChange: (vals) => setFilter(col, vals),
            }
          : undefined
      }
    />
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Summary — at-a-glance reference for admin/CEO */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Lead ทั้งหมด" value={rows.length} hint="รับเข้า + มอบหมาย" />
        <Stat label="มอบหมายแล้ว" value={assignedCount} hint={`${rows.length ? Math.round((assignedCount / rows.length) * 100) : 0}% ของทั้งหมด`} />
        <Stat label="ยังไม่มอบหมาย" value={unassignedCount} delta={unassignedCount > 0 ? { value: "ต้องจัดการ", positive: false } : undefined} />
        <Stat label="ปิดได้ (Win)" value={winCount} />
      </div>

      <Card>
        <div className="flex items-center gap-2.5 p-3 border-b border-border flex-wrap">
          <div className="relative w-full sm:w-auto">
            <Search size={14} strokeWidth={1.75} className="text-text-subtle absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาลูกค้า / เบอร์ / รหัสทรัพย์…" className="w-full sm:w-64 pl-8" />
          </div>
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 text-small font-medium rounded-md px-3 py-1.5 border border-border-strong text-text-muted hover:bg-surface-2 transition-colors"
          >
            <Download size={14} strokeWidth={1.75} /> ส่งออก CSV
          </button>
          {activeFilterCols > 0 && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 text-small font-medium rounded-md px-3 py-1.5 border border-accent bg-accent-wash text-accent transition-colors hover:bg-accent-wash/70"
            >
              <X size={14} strokeWidth={2} /> ล้างตัวกรอง ({activeFilterCols})
            </button>
          )}
          <div className="flex gap-1.5 ml-auto">
            {([
              { key: "all", label: `ทั้งหมด (${rows.length})` },
              { key: "unassigned", label: `ยังไม่มอบหมาย (${unassignedCount})` },
            ] as const).map((c) => (
              <button
                key={c.key}
                onClick={() => setQuick(c.key)}
                className={cn(
                  "text-small font-medium rounded-md px-3 py-1.5 border transition-colors",
                  quick === c.key ? "bg-text text-background border-text" : "border-border-strong text-text-muted hover:bg-surface-2"
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {total === 0 ? (
          <div className="p-10 text-center text-small text-text-subtle">ไม่พบลีด</div>
        ) : (
          <>
            <CardContent className="p-0">
              <Table className="min-w-[1040px] whitespace-nowrap">
                <THead>
                  <TR>
                    {colHeader("ลูกค้า", "name")}
                    {colHeader("ประเภท", "type", "type")}
                    {colHeader("ช่องทาง", "source", "source")}
                    {colHeader("ทรัพย์ที่สนใจ", "listing")}
                    {colHeader("งบ", "budget", undefined, "right", "desc")}
                    {colHeader("สเตจ", "stage", "stage")}
                    {colHeader("สถานะ", "status", "status")}
                    {colHeader("มอบหมายให้", "assigned", "assigned")}
                    {colHeader("วันที่รับ", "date", undefined, "right", "desc")}
                  </TR>
                </THead>
                <TBody>
                  {pageRows.map((r) => {
                    const cur = effectiveSale(r);
                    const isOwnerSale = !!r.listing_code && cur && cur === defaultAssignee(r.listing_code);
                    const stg = stageMeta(r.stage);
                    return (
                      <TR
                        key={r.lead_id}
                        className={cn(!r.isNew && "cursor-pointer")}
                        onClick={r.isNew ? undefined : () => router.push(`/leads/${r.lead_id}`)}
                      >
                        <TD>
                          <div className="flex items-center gap-2.5">
                            <Avatar name={r.lead_name} tone="crimson" />
                            <div className="min-w-0">
                              <div className="font-medium truncate inline-flex items-center gap-1.5">
                                {r.lead_name}
                                {r.isNew && (
                                  <span className="inline-flex items-center gap-0.5 text-label text-accent bg-accent-wash rounded px-1"><Sparkles size={9} strokeWidth={2} /> ใหม่</span>
                                )}
                              </div>
                              <div className="text-label text-text-subtle num">{r.phone ?? "—"}</div>
                            </div>
                          </div>
                        </TD>
                        <TD className="text-small text-text-muted">{r.type}</TD>
                        <TD>{r.source ? <Pill tone="neutral">{r.source}</Pill> : <span className="text-text-subtle">—</span>}</TD>
                        <TD className="num text-small text-text-muted">{r.listing_code ?? "—"}</TD>
                        <TD className="num text-right text-text-muted">{r.budgetBaht != null ? formatBaht(r.budgetBaht) : "—"}</TD>
                        <TD>
                          <span className="inline-flex items-center gap-1.5 text-body whitespace-nowrap"><Dot className={stg.dot} />{stg.th}</span>
                        </TD>
                        <TD>{r.status ? <StatusBadge color={leadStatusDot(r.status)}>{r.status}</StatusBadge> : "—"}</TD>
                        <TD onClick={(e) => e.stopPropagation()} className="cursor-default">
                          <div className="flex items-center gap-1.5">
                            <select
                              value={cur}
                              onChange={(e) => assign(r.lead_id, e.target.value, currentUser.name, cur)}
                              className="h-8 px-2 rounded-md border border-border-strong bg-surface text-small focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                            >
                              <option value="">— ยังไม่มอบหมาย —</option>
                              {cur && !agents.some((a) => a.nickname === cur) && <option value={cur}>{cur}</option>}
                              {agents.map((a) => (
                                <option key={a.id} value={a.nickname}>{a.nickname}</option>
                              ))}
                            </select>
                            {isOwnerSale && (
                              <span className="text-label text-green inline-flex items-center gap-0.5 shrink-0" title="เจ้าของทรัพย์ที่ลูกค้าสนใจ">
                                <Check size={12} strokeWidth={2.5} /> เจ้าของ
                              </span>
                            )}
                          </div>
                        </TD>
                        <TD className="text-right text-small text-text-muted num">{formatThaiDate(r.date)}</TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </CardContent>

            <Pagination
              total={total}
              page={safePage}
              pageCount={pageCount}
              pageSize={pageSize}
              start={start}
              shown={pageRows.length}
              onPage={setPage}
              onPageSize={setPageSize}
            />
          </>
        )}
      </Card>
    </div>
  );
}

// Row → sort value per column key. Categorical columns sort by domain order (not alphabet).
const SORT_VALUE: Record<string, (r: Row, sale: (r: Row) => string) => number | string | null> = {
  name: (r) => r.lead_name,
  type: (r) => r.type,
  source: (r) => r.source,
  listing: (r) => r.listing_code,
  budget: (r) => r.budgetBaht,
  stage: (r) => orderIndex(STAGE_KEYS, r.stage),
  status: (r) => orderIndex(STATUS_ORDER, r.status),
  assigned: (r, sale) => sale(r) || null,
  date: (r) => r.date,
};

function labelFor(col: FilterCol, value: string): string {
  if (value === "") {
    if (col === "assigned") return "— ยังไม่มอบหมาย —";
    if (col === "source") return "ไม่ระบุ";
    return "—";
  }
  if (col === "stage") return stageMeta(value).th;
  return value;
}

// ── Sortable + optionally value-filterable column header (Google-Sheets style) ──────────
function ColHeader({
  label,
  sortKey,
  sort,
  onSort,
  align,
  defaultDir = "asc",
  filter,
}: {
  label: string;
  sortKey: string;
  sort: { key: string; dir: SortDir };
  onSort: (key: string, defaultDir: SortDir) => void;
  align?: "right";
  defaultDir?: SortDir;
  filter?: {
    active: boolean;
    items: { value: string; label: string; count: number }[];
    selected: string[];
    onChange: (vals: string[]) => void;
  };
}) {
  const active = sort.key === sortKey;
  const [menu, setMenu] = React.useState<DOMRect | null>(null);

  return (
    <TH className={align === "right" ? "text-right" : undefined}>
      <div className={cn("inline-flex items-center gap-1", align === "right" && "flex-row-reverse")}>
        <button
          type="button"
          onClick={() => onSort(sortKey, defaultDir)}
          className={cn("group -mx-1 px-1 inline-flex items-center gap-1 rounded transition-colors hover:text-text-muted", align === "right" && "flex-row-reverse", active && "text-text")}
        >
          {label}
          <span className="shrink-0">
            {active ? (
              sort.dir === "asc" ? <ChevronUp size={12} strokeWidth={2.25} /> : <ChevronDown size={12} strokeWidth={2.25} />
            ) : (
              <ChevronsUpDown size={12} strokeWidth={2} className="opacity-30 group-hover:opacity-70 transition-opacity" />
            )}
          </span>
        </button>
        {filter && (
          <button
            type="button"
            aria-label={`กรอง ${label}`}
            onClick={(e) => setMenu(menu ? null : e.currentTarget.getBoundingClientRect())}
            className={cn("relative shrink-0 rounded p-0.5 transition-colors hover:text-text-muted", filter.active ? "text-accent" : "text-text-subtle/50")}
          >
            <Filter size={12} strokeWidth={2} fill={filter.active ? "currentColor" : "none"} />
          </button>
        )}
      </div>
      {filter && menu && (
        <ValueFilter
          rect={menu}
          items={filter.items}
          selected={filter.selected}
          onChange={filter.onChange}
          onClose={() => setMenu(null)}
        />
      )}
    </TH>
  );
}

// ── Value-list filter popover (checkbox list with search + select-all) ──────────────────
function ValueFilter({
  rect,
  items,
  selected,
  onChange,
  onClose,
}: {
  rect: DOMRect;
  items: { value: string; label: string; count: number }[];
  selected: string[];
  onChange: (vals: string[]) => void;
  onClose: () => void;
}) {
  const [q, setQ] = React.useState("");
  // Empty selection = no filter (all). Track the working set locally.
  const query = q.trim().toLowerCase();
  const shown = items.filter((it) => it.label.toLowerCase().includes(query));
  const sel = new Set(selected);
  const allShownSelected = shown.length > 0 && shown.every((it) => sel.has(it.value));

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  const toggle = (value: string) => {
    const next = new Set(sel);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange([...next]);
  };
  const toggleAllShown = () => {
    const next = new Set(sel);
    if (allShownSelected) shown.forEach((it) => next.delete(it.value));
    else shown.forEach((it) => next.add(it.value));
    onChange([...next]);
  };

  const width = 240;
  const left = Math.min(rect.left, window.innerWidth - width - 8);
  const top = Math.min(rect.bottom + 4, window.innerHeight - 320);

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed z-50 rounded-lg border border-border bg-surface shadow-pop p-2 flex flex-col gap-1.5" style={{ left, top, width }} onClick={(e) => e.stopPropagation()}>
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาค่า…" className="h-8" />
        <div className="flex items-center justify-between px-1">
          <button onClick={toggleAllShown} className="text-label font-medium text-accent hover:underline">
            {allShownSelected ? "ล้างที่แสดง" : "เลือกทั้งหมด"}
          </button>
          {selected.length > 0 && (
            <button onClick={() => onChange([])} className="text-label text-text-subtle hover:text-text">ล้างตัวกรอง</button>
          )}
        </div>
        <div className="max-h-56 overflow-y-auto flex flex-col gap-0.5 scroll-thin">
          {shown.map((it) => {
            const on = sel.has(it.value);
            return (
              <button key={it.value || "__blank"} onClick={() => toggle(it.value)} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-small hover:bg-surface-hover transition-colors text-left">
                <span className={cn("size-4 shrink-0 grid place-items-center rounded border", on ? "bg-accent border-accent text-text-onaccent" : "border-border-strong")}>
                  {on && <Check size={11} strokeWidth={3} />}
                </span>
                <span className="truncate flex-1">{it.label}</span>
                <span className="num text-label text-text-subtle shrink-0">{it.count}</span>
              </button>
            );
          })}
          {shown.length === 0 && <div className="px-2 py-3 text-center text-label text-text-subtle">ไม่พบค่า</div>}
        </div>
      </div>
    </>
  );
}

// ── Pagination footer ───────────────────────────────────────────────────────────────────
function Pagination({
  total,
  page,
  pageCount,
  pageSize,
  start,
  shown,
  onPage,
  onPageSize,
}: {
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
  start: number;
  shown: number;
  onPage: (p: number) => void;
  onPageSize: (n: number) => void;
}) {
  const from = total === 0 ? 0 : start + 1;
  const to = start + shown;
  const btn = "size-8 grid place-items-center rounded-md border border-border-strong text-text-muted hover:bg-surface-2 transition-colors disabled:opacity-40 disabled:pointer-events-none";
  return (
    <div className="flex items-center gap-3 p-3 border-t border-border flex-wrap">
      <div className="text-small text-text-muted">
        <span className="num text-text">{from.toLocaleString("en-US")}–{to.toLocaleString("en-US")}</span> จาก <span className="num text-text">{total.toLocaleString("en-US")}</span> รายการ
      </div>
      <label className="flex items-center gap-1.5 text-small text-text-muted ml-2">
        แสดง
        <select
          value={pageSize}
          onChange={(e) => onPageSize(Number(e.target.value))}
          className="h-8 px-2 rounded-md border border-border-strong bg-surface text-small num focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {PAGE_SIZES.map((n) => (<option key={n} value={n}>{n}</option>))}
        </select>
        / หน้า
      </label>
      <div className="flex items-center gap-1.5 ml-auto">
        <button className={btn} onClick={() => onPage(1)} disabled={page <= 1} aria-label="หน้าแรก"><ChevronsLeft size={15} strokeWidth={1.75} /></button>
        <button className={btn} onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="หน้าก่อนหน้า"><ChevronLeft size={15} strokeWidth={1.75} /></button>
        <span className="text-small text-text-muted px-1">หน้า <span className="num text-text">{page}</span> / <span className="num">{pageCount}</span></span>
        <button className={btn} onClick={() => onPage(page + 1)} disabled={page >= pageCount} aria-label="หน้าถัดไป"><ChevronRight size={15} strokeWidth={1.75} /></button>
        <button className={btn} onClick={() => onPage(pageCount)} disabled={page >= pageCount} aria-label="หน้าสุดท้าย"><ChevronsRight size={15} strokeWidth={1.75} /></button>
      </div>
    </div>
  );
}
