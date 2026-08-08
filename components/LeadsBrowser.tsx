"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Plus, X, Tags, Check, Columns3, GripVertical, RotateCcw, ListFilter, ChevronDown } from "lucide-react";
import type { CrmRow } from "@/lib/queries";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { SortHeader, useSort } from "@/components/ui/SortHeader";
import { StatusBadge, Dot } from "@/components/ui/Dot";
import { Pill } from "@/components/ui/Pill";
import { Avatar } from "@/components/ui/Avatar";
import { GradeChip } from "@/components/ui/GradeChip";
import { STAGES, stageMeta } from "@/lib/pipeline";
import { findTag, TAG_TONE_CLASS, type LeadTag } from "@/lib/tags";
import { useMasterData } from "@/components/MasterDataProvider";
import { setLeadTag } from "@/lib/mutations/leads";
import { formatBaht, formatDate } from "@/lib/format";
import { leadStatusDot } from "@/lib/status";
import { compareValues, orderIndex } from "@/lib/sort";
import { cn } from "@/lib/cn";

const STAGE_KEYS = STAGES.map((s) => s.key);
const LEAD_POTENTIAL_ORDER = ["A", "B", "C", "New Lead"];
const LEAD_STATUS_ORDER = ["Active", "Win", "Lose", "Reject"];

const SORT_VALUE: Record<string, (c: CrmRow) => number | string | null> = {
  lead_id: (c) => c.lead_id,
  name: (c) => c.lead_name,
  potential: (c) => orderIndex(LEAD_POTENTIAL_ORDER, c.potential),
  stage: (c) => orderIndex(STAGE_KEYS, c.pipeline_stage),
  status: (c) => orderIndex(LEAD_STATUS_ORDER, c.lead_status),
  budget: (c) => c.budget,
  commission: (c) => c.commission,
  follow: (c) => c.last_follow_date,
};

// ── Column model (order is data-driven → reorderable) ─────────────────────────
type ColId =
  | "lead_id" | "name" | "potential" | "stage" | "status"
  | "type" | "tags" | "sale" | "budget" | "commission" | "follow";

const COLS: Record<ColId, { label: string; sortKey?: string; align?: "right"; defaultDir?: "asc" | "desc" }> = {
  lead_id: { label: "Lead ID", sortKey: "lead_id" },
  name: { label: "ลูกค้า", sortKey: "name" },
  potential: { label: "เกรด", sortKey: "potential" },
  stage: { label: "สเตจ", sortKey: "stage" },
  status: { label: "สถานะ", sortKey: "status" },
  type: { label: "ประเภท" },
  tags: { label: "แท็ก" },
  sale: { label: "เซล" },
  budget: { label: "งบประมาณ", sortKey: "budget", align: "right", defaultDir: "desc" },
  commission: { label: "คอมมิชชั่น", sortKey: "commission", align: "right", defaultDir: "desc" },
  follow: { label: "ติดตามล่าสุด", sortKey: "follow", align: "right", defaultDir: "desc" },
};
const DEFAULT_ORDER: ColId[] = ["lead_id", "name", "potential", "stage", "status", "type", "tags", "sale", "budget", "commission", "follow"];
const ALL_IDS = new Set(DEFAULT_ORDER);
const ORDER_KEY = "haus.leads.colOrder";

/** Normalize a stored order: keep known ids in stored order, append any missing. */
function normalizeOrder(stored: unknown): ColId[] {
  if (!Array.isArray(stored)) return DEFAULT_ORDER;
  const kept = stored.filter((x): x is ColId => typeof x === "string" && ALL_IDS.has(x as ColId));
  const seen = new Set(kept);
  return [...kept, ...DEFAULT_ORDER.filter((id) => !seen.has(id))];
}

function move<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr];
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it);
  return next;
}

// ── Tag chip ──────────────────────────────────────────────────────────────────
// Colour comes from the tag's STORED tone (CEO-chosen in Settings), not a hash.
function TagChip({ tag, onRemove }: { tag: LeadTag; onRemove?: () => void }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-label font-medium whitespace-nowrap", TAG_TONE_CLASS[tag.tone])}>
      {tag.label}
      {onRemove && (
        <button onClick={(e) => { e.stopPropagation(); onRemove(); }} aria-label={`ลบแท็ก ${tag.label}`} className="opacity-60 hover:opacity-100">
          <X size={11} strokeWidth={2.5} />
        </button>
      )}
    </span>
  );
}

export function LeadsBrowser({ crm }: { crm: CrmRow[] }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [stage, setStage] = React.useState("all");
  const [groupBy, setGroupBy] = React.useState(false);
  const [colsOpen, setColsOpen] = React.useState(false);
  const [order, setOrder] = React.useState<ColId[]>(DEFAULT_ORDER);
  const { sort, onSort } = useSort();

  // Load saved column order once on mount.
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(ORDER_KEY);
      if (raw) setOrder(normalizeOrder(JSON.parse(raw)));
    } catch {
      /* ignore */
    }
  }, []);
  // Persist on user action (not via effect) to avoid the mount-time overwrite race.
  const applyOrder = React.useCallback((o: ColId[]) => {
    setOrder(o);
    try {
      localStorage.setItem(ORDER_KEY, JSON.stringify(o));
    } catch {
      /* ignore */
    }
  }, []);

  // Lead group tag — ONE per lead (CEO: "ติดได้คนเดียว"), chosen from the CEO-governed list
  // in Settings → แท็ก Lead. Sales cannot create tags. `tag_id` comes from the server-fetched
  // `crm` prop (main_6_buyer_crm.tag_id) — `tagOverride` is a local optimistic layer only,
  // reconciled by router.refresh() after every pick, so a picked tag shows instantly without
  // waiting on the round trip, and the table + lead detail page never disagree for long.
  const { leadTags } = useMasterData();
  const [tagOverride, setTagOverride] = React.useState<Record<string, string | null>>({});
  const [openLead, setOpenLead] = React.useState<{ id: string; rect: DOMRect } | null>(null);

  const effectiveTagId = (c: CrmRow): string | null =>
    c.lead_id in tagOverride ? tagOverride[c.lead_id] : c.tag_id;

  /** The lead's tag, resolved against the LIVE governed list. A tag deleted in Settings
   *  resolves to null here, so the table never shows a tag that no longer exists. */
  const tagOf = (c: CrmRow): LeadTag | null => findTag(leadTags, effectiveTagId(c));

  async function pickTag(leadId: string, tagId: string | null) {
    setOpenLead(null);
    const prev = effectiveTagId(crm.find((c) => c.lead_id === leadId) ?? { lead_id: leadId, tag_id: null } as CrmRow);
    setTagOverride((m) => ({ ...m, [leadId]: tagId }));
    const result = await setLeadTag(leadId, tagId);
    if (!result.ok) setTagOverride((m) => ({ ...m, [leadId]: prev }));
    router.refresh();
  }

  const stageOptions = [
    { key: "all", label: "ทั้งหมด", count: crm.length },
    ...STAGES.filter((s) => crm.some((c) => c.pipeline_stage === s.key)).map((s) => ({
      key: s.key,
      label: s.th,
      count: crm.filter((c) => c.pipeline_stage === s.key).length,
    })),
  ];

  const query = q.trim().toLowerCase();
  const filtered = crm
    .filter((c) => stage === "all" || c.pipeline_stage === stage)
    .filter(
      (c) =>
        !query ||
        [c.lead_name, c.phone, c.lead_id].some((v) => v?.toLowerCase().includes(query)) ||
        (tagOf(c)?.label.toLowerCase().includes(query) ?? false)
    );

  const sortFn = SORT_VALUE[sort.key];
  const rows = sortFn ? [...filtered].sort((a, b) => compareValues(sortFn(a), sortFn(b), sort.dir)) : filtered;

  // Single-select makes these buckets DISJOINT — every lead lands in exactly one group, so
  // the group counts now sum to the row count. (Under the old multi-tag model a lead was
  // duplicated into every group it carried and the totals never added up.)
  const groups = React.useMemo(() => {
    if (!groupBy) return null;
    const byTag = new Map<string, CrmRow[]>();
    const untagged: CrmRow[] = [];
    for (const c of rows) {
      const t = tagOf(c);
      if (!t) untagged.push(c);
      else byTag.set(t.id, [...(byTag.get(t.id) ?? []), c]);
    }
    // Order follows the CEO's list order in Settings, not row count — a standard vocabulary
    // should read the same way everywhere.
    const out: { tag: LeadTag | null; rows: CrmRow[] }[] = leadTags
      .filter((t) => byTag.has(t.id))
      .map((t) => ({ tag: t, rows: byTag.get(t.id)! }));
    if (untagged.length) out.push({ tag: null, rows: untagged });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupBy, rows, tagOverride, leadTags]);

  // ── header + cell renderers keyed by column id ──────────────────────────────
  const headerFor = (colId: ColId) => {
    const cfg = COLS[colId];
    return cfg.sortKey ? (
      <SortHeader key={colId} label={cfg.label} sortKey={cfg.sortKey} sort={sort} onSort={onSort} align={cfg.align} defaultDir={cfg.defaultDir} />
    ) : (
      <TH key={colId} className={cfg.align === "right" ? "text-right" : undefined}>{cfg.label}</TH>
    );
  };

  const cellFor = (colId: ColId, c: CrmRow): React.ReactNode => {
    switch (colId) {
      case "lead_id":
        return (
          <TD key={colId} className="num text-small text-text-muted">
            <Link href={`/leads/${c.lead_id}`} onClick={(e) => e.stopPropagation()} className="hover:text-accent hover:underline">{c.lead_id}</Link>
          </TD>
        );
      case "name":
        return (
          <TD key={colId}>
            <div className="flex items-center gap-2.5">
              <Avatar name={c.lead_name} tone="crimson" />
              <div className="min-w-0">
                <div className="font-medium truncate">{c.lead_name}</div>
                <div className="text-label text-text-subtle num">{c.phone}</div>
              </div>
            </div>
          </TD>
        );
      case "potential":
        return <TD key={colId}><GradeChip grade={c.potential ?? ""} /></TD>;
      case "stage": {
        const stg = stageMeta(c.pipeline_stage);
        return (
          <TD key={colId}>
            <span className="inline-flex items-center gap-1.5 text-body whitespace-nowrap"><Dot className={stg.dot} />{stg.th}</span>
          </TD>
        );
      }
      case "status":
        return <TD key={colId}><StatusBadge color={leadStatusDot(c.lead_status)}>{c.lead_status}</StatusBadge></TD>;
      case "type":
        return <TD key={colId}><Pill className="whitespace-nowrap">{c.lead_type ?? "—"}</Pill></TD>;
      case "tags": {
        // One tag max — so the cell is a single chip (tap to change) or an empty picker
        // button, never a growing chip list.
        const tag = tagOf(c);
        return (
          <TD key={colId} onClick={(e) => e.stopPropagation()} className="cursor-default">
            <button
              onClick={(e) => setOpenLead({ id: c.lead_id, rect: e.currentTarget.getBoundingClientRect() })}
              aria-label={tag ? `เปลี่ยนแท็ก (${tag.label})` : "เลือกแท็ก"}
              className="inline-flex items-center gap-1 rounded transition-colors"
            >
              {tag ? (
                <TagChip tag={tag} />
              ) : (
                <span className="inline-flex items-center gap-1 rounded border border-dashed border-border-strong px-1.5 py-0.5 text-label text-text-subtle hover:text-accent hover:border-accent transition-colors">
                  <Plus size={11} strokeWidth={2} /> แท็ก
                </span>
              )}
            </button>
          </TD>
        );
      }
      case "sale":
        return (
          <TD key={colId}>
            <span className="inline-flex items-center gap-1.5">
              <Avatar name={c.sale_id ?? ""} tone="crimson" className="h-5 w-5" />
              <span className="text-small num text-text-muted">{c.sale_id}</span>
            </span>
          </TD>
        );
      case "budget":
        return <TD key={colId} className="text-right num">{formatBaht(c.budget)}</TD>;
      case "commission":
        return <TD key={colId} className="text-right num text-green">{c.commission ? formatBaht(c.commission) : "—"}</TD>;
      case "follow":
        return <TD key={colId} className="text-right text-small text-text-muted num">{formatDate(c.last_follow_date)}</TD>;
    }
  };

  const renderRow = (c: CrmRow, keyPrefix = "") => (
    <TR key={`${keyPrefix}${c.lead_id}`} className="cursor-pointer" onClick={() => router.push(`/leads/${c.lead_id}`)}>
      {order.map((colId) => cellFor(colId, c))}
    </TR>
  );

  return (
    <Card>
      {/* Toolbar */}
      <div className="flex items-center gap-2.5 p-3 border-b border-border flex-wrap">
        <div className="relative w-full sm:w-auto">
          <Search size={14} strokeWidth={1.75} className="text-text-subtle absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อ / เบอร์ / รหัส / แท็ก…" className="w-full sm:w-64 pl-8" />
        </div>
        <button
          onClick={() => setGroupBy((v) => !v)}
          className={cn("inline-flex items-center gap-1.5 text-small font-medium rounded-md px-3 py-1.5 border transition-colors", groupBy ? "bg-accent-wash text-accent border-accent" : "border-border-strong text-text-muted hover:bg-surface-2")}
        >
          <Tags size={14} strokeWidth={1.75} /> จัดกลุ่มตามแท็ก
        </button>
        <button
          onClick={() => setColsOpen(true)}
          className="inline-flex items-center gap-1.5 text-small font-medium rounded-md px-3 py-1.5 border border-border-strong text-text-muted hover:bg-surface-2 transition-colors"
        >
          <Columns3 size={14} strokeWidth={1.75} /> คอลัมน์
        </button>
        <div className="ml-auto">
          <StageFilter value={stage} options={stageOptions} onChange={setStage} />
        </div>
      </div>

      <CardContent className="p-0">
        {rows.length === 0 ? (
          <div className="p-10 text-center text-small text-text-subtle">ไม่พบรายการ</div>
        ) : (
          <Table className="min-w-[1180px] whitespace-nowrap">
            <THead>
              <TR>{order.map((colId) => headerFor(colId))}</TR>
            </THead>
            <TBody>
              {groups
                ? groups.map((g) => (
                    <React.Fragment key={g.tag?.id ?? "__untagged"}>
                      <TR className="bg-surface-2/60">
                        <TD colSpan={order.length} className="py-2">
                          <span className="inline-flex items-center gap-2">
                            {g.tag ? <TagChip tag={g.tag} /> : <span className="text-small text-text-subtle">ไม่มีแท็ก</span>}
                            <span className="num text-label text-text-subtle">({g.rows.length})</span>
                          </span>
                        </TD>
                      </TR>
                      {g.rows.map((c) => renderRow(c, `${g.tag?.id ?? "none"}-`))}
                    </React.Fragment>
                  ))
                : rows.map((c) => renderRow(c))}
            </TBody>
          </Table>
        )}
      </CardContent>

      {openLead && (
        <TagPopover
          rect={openLead.rect}
          tags={leadTags}
          selected={effectiveTagId(crm.find((c) => c.lead_id === openLead.id) ?? ({ lead_id: openLead.id, tag_id: null } as CrmRow))}
          onPick={(t) => pickTag(openLead.id, t)}
          onClose={() => setOpenLead(null)}
        />
      )}

      {colsOpen && (
        <ColumnsModal order={order} onChange={applyOrder} onReset={() => applyOrder(DEFAULT_ORDER)} onClose={() => setColsOpen(false)} />
      )}
    </Card>
  );
}

// ── Stage filter dropdown (compact — replaces the chip row) ───────────────────
function StageFilter({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { key: string; label: string; count: number }[];
  onChange: (k: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const active = value !== "all";
  const current = options.find((o) => o.key === value) ?? options[0];

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-1.5 text-small font-medium rounded-md px-3 py-1.5 border transition-colors",
          active ? "bg-accent-wash text-accent border-accent" : "border-border-strong text-text-muted hover:bg-surface-2"
        )}
      >
        <ListFilter size={14} strokeWidth={1.75} />
        <span>สเตจ{active ? `: ${current.label}` : ""}</span>
        <ChevronDown size={13} strokeWidth={2} className={cn("transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 w-52 rounded-lg border border-border bg-surface shadow-pop p-1 flex flex-col gap-0.5 max-h-80 overflow-y-auto">
            {options.map((o) => (
              <button
                key={o.key}
                onClick={() => {
                  onChange(o.key);
                  setOpen(false);
                }}
                className="flex items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-small hover:bg-surface-hover transition-colors text-left"
              >
                <span className={cn("truncate", o.key === value && "text-accent font-medium")}>{o.label}</span>
                <span className="inline-flex items-center gap-1.5 shrink-0">
                  <span className="num text-label text-text-subtle">{o.count}</span>
                  {o.key === value && <Check size={14} strokeWidth={2.5} className="text-accent" />}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Column reorder modal (drag-and-drop, Airtable-style) ──────────────────────
function ColumnsModal({
  order,
  onChange,
  onReset,
  onClose,
}: {
  order: ColId[];
  onChange: (o: ColId[]) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const [dragIdx, setDragIdx] = React.useState<number | null>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center">
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" className="w-full sm:max-w-sm bg-surface rounded-t-xl sm:rounded-xl border border-border shadow-pop p-4 flex flex-col gap-3 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="text-h2">จัดเรียงคอลัมน์</div>
          <button onClick={onClose} aria-label="ปิด" className="size-8 grid place-items-center rounded-md text-text-subtle hover:bg-surface-hover hover:text-text transition-colors">
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>
        <p className="text-small text-text-muted -mt-1">ลากเพื่อเปลี่ยนลำดับคอลัมน์ในตาราง</p>

        <div className="flex flex-col gap-1">
          {order.map((colId, i) => (
            <div
              key={colId}
              draggable
              onDragStart={() => setDragIdx(i)}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragIdx === null || dragIdx === i) return;
                onChange(move(order, dragIdx, i));
                setDragIdx(i);
              }}
              onDragEnd={() => setDragIdx(null)}
              className={cn(
                "flex items-center gap-2.5 rounded-md border px-3 py-2.5 bg-surface cursor-grab active:cursor-grabbing transition-colors",
                dragIdx === i ? "border-accent bg-accent-wash" : "border-border hover:bg-surface-2"
              )}
            >
              <GripVertical size={16} strokeWidth={1.75} className="text-text-subtle shrink-0" />
              <span className="num text-label text-text-subtle w-5">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-body">{COLS[colId].label}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 mt-1">
          <button onClick={onReset} className="inline-flex items-center gap-1.5 text-small text-text-muted hover:text-text transition-colors">
            <RotateCcw size={14} strokeWidth={1.75} /> ค่าเริ่มต้น
          </button>
          <button onClick={onClose} className="ml-auto h-9 px-4 rounded-md bg-accent text-text-onaccent font-medium hover:bg-accent-hover transition-colors">
            เสร็จสิ้น
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tag picker popover ────────────────────────────────────────────────────────
// A PICKER, not an editor: the list is the CEO-governed vocabulary and there is no
// create-new path. Single-select — choosing a tag replaces whatever was there and closes.
function TagPopover({
  rect,
  tags,
  selected,
  onPick,
  onClose,
}: {
  rect: DOMRect;
  tags: LeadTag[];
  selected: string | null;
  onPick: (tagId: string | null) => void;
  onClose: () => void;
}) {
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

  const width = 240;
  const left = Math.min(rect.left, window.innerWidth - width - 8);
  const top = Math.min(rect.bottom + 4, window.innerHeight - 300);

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed z-50 w-60 rounded-lg border border-border bg-surface shadow-pop p-2 flex flex-col gap-0.5" style={{ left, top }} onClick={(e) => e.stopPropagation()}>
        <div className="px-2 pt-1 pb-1.5 text-label text-text-subtle">เลือกได้ 1 แท็ก</div>
        <div className="max-h-56 overflow-y-auto flex flex-col gap-0.5">
          {tags.map((t) => {
            const on = selected === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  onPick(t.id);
                  onClose();
                }}
                className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-small hover:bg-surface-hover transition-colors text-left"
              >
                <TagChip tag={t} />
                {on && <Check size={14} strokeWidth={2.5} className="text-accent shrink-0" />}
              </button>
            );
          })}
          {tags.length === 0 && (
            <div className="px-2 py-3 text-center text-label text-text-subtle">
              ยังไม่มีแท็ก — ตั้งค่าที่ ตั้งค่า → แท็ก Lead
            </div>
          )}
        </div>
        {selected && (
          <button
            onClick={() => {
              onPick(null);
              onClose();
            }}
            className="mt-1 border-t border-border pt-2 px-2 pb-1 text-left text-small text-text-muted hover:text-accent transition-colors"
          >
            เอาแท็กออก
          </button>
        )}
      </div>
    </>
  );
}
