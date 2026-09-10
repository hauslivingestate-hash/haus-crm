"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Plus, X, Tags, Check, Columns3, GripVertical, RotateCcw, ListFilter, ChevronDown } from "lucide-react";
import type { CrmRow } from "@/lib/queries";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useSort } from "@/components/ui/SortHeader";
import { SheetTable, Val, Dim } from "@/components/ui/SheetTable";
import type { SheetColumn, TablePrefs } from "@/lib/tables";
import { lookupFill, slaFill, type LookupColors } from "@/lib/tables/fills";
import { isClosed } from "@/lib/deals";
import { stashLead } from "@/lib/peek";
import type { SlaWindows } from "@/lib/sla";
import { stageMeta, STAGES as SEED_STAGES } from "@/lib/pipeline";
import { findTag, TAG_TONE_CLASS, type LeadTag } from "@/lib/tags";
import { useMasterData } from "@/components/MasterDataProvider";
import { useRbac } from "@/components/RbacProvider";
import { setLeadTag, createLead } from "@/lib/mutations/leads";
import { formatBaht, formatDate } from "@/lib/format";
import { leadStatusDot } from "@/lib/status";
import { compareValues, orderIndex } from "@/lib/sort";
import { cn } from "@/lib/cn";

// Sort order for the ขั้นตอน column. The seed order, not the governed one — sorting a
// grid column is presentation, and threading the live list through the module-level
// comparator map would mean rebuilding it on every render for no visible gain.
const STAGE_KEYS = SEED_STAGES.map((s) => s.key);
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

export function LeadsBrowser({ crm, prefs, colors, sla }: {
  crm: CrmRow[];
  /** This viewer's saved column layout. Undefined = never opened the manager. */
  prefs?: TablePrefs;
  /** Admin-chosen colour per lookup value — ตั้งค่า → ข้อมูลอ้างอิงกลาง. */
  colors: LookupColors;
  /** Lead grade → follow-up window in days. Missing/null = no SLA. */
  sla: SlaWindows;
}) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [stage, setStage] = React.useState("all");
  const [groupBy, setGroupBy] = React.useState(false);
  const [colsOpen, setColsOpen] = React.useState(false);
  const [order, setOrder] = React.useState<ColId[]>(DEFAULT_ORDER);
  const { sort } = useSort();

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
  const { leadTags, pipelineStages } = useMasterData();
  const { can } = useRbac();
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

  /* Filter chips, in the pipeline's own order — read from ตั้งค่า rather than the STAGES
     constant so a stage renamed there keeps its chip instead of quietly disappearing from
     the filters while its leads stay in the grid. Only stages someone is actually on get a
     chip; an empty stage is a filter that returns nothing. */
  const stageOptions = [
    { key: "all", label: "ทั้งหมด", count: crm.length },
    ...pipelineStages
      .filter((s) => crm.some((c) => c.pipeline_stage === s.id))
      .map((s) => ({
        key: s.id,
        label: stageMeta(s.id).label,
        count: crm.filter((c) => c.pipeline_stage === s.id).length,
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

  /* THE COLUMN REGISTRY. Every field `getCrm` returns gets a column — the old
     table showed 11 of 19, and the missing eight (phone, LINE, source, the
     three complaint fields, listing code, received date) were the ones you had
     to open a record to see.

     Cells are plain text, not chips. In a 30px row an avatar or a pill sets
     the row height and breaks the lattice; the colour lives on the cell now,
     which is what made the chips redundant in the first place. */
  const columns = React.useMemo<SheetColumn<CrmRow>[]>(() => [
    { key: "lead_id", label: "Lead ID", locked: true, width: 96,
      cell: (c) => <span className="num text-accent">{c.lead_id}</span> },
    { key: "name", label: "ลูกค้า", width: 160, cell: (c) => <Val>{c.lead_name}</Val>,
      // The only field createLead refuses without. Being `required` also pins
      // the column visible — a hidden required field is an uncommittable row.
      add: { field: "lead_name", editor: { as: "text" }, required: true, placeholder: "ชื่อลูกค้าใหม่…" } },
    { key: "phone", label: "เบอร์โทร", cell: (c) => <Val mono>{c.phone}</Val>,
      add: { field: "phone", editor: { as: "text" } } },
    { key: "line_id", label: "LINE", cell: (c) => <Val mono>{c.line_id}</Val> },
    { key: "potential", label: "เกรด", align: "center", width: 72,
      cell: (c) => <Val>{c.potential}</Val>,
      fill: (c) => lookupFill(colors.potential, c.potential) },
    { key: "stage", label: "สเตจ", width: 116,
      cell: (c) => <Val>{stageMeta(c.pipeline_stage).label}</Val>,
      fill: (c) => lookupFill(colors.pipeline_stage, c.pipeline_stage) },
    { key: "status", label: "สถานะ", width: 96,
      cell: (c) => <Val>{c.lead_status}</Val>,
      fill: (c) => lookupFill(colors.lead_status, c.lead_status) },
    { key: "type", label: "ประเภท", cell: (c) => <Val>{c.lead_type}</Val> },
    { key: "tags", label: "แท็ก", width: 120,
      // The one interactive cell. Its own click must not also open the lead,
      // so it stops propagation before the row's handler sees it.
      cell: (c) => {
        const tag = tagOf(c);
        return (
          <span onClick={(e) => e.stopPropagation()} className="inline-flex">
            <button
              onClick={(e) => setOpenLead({ id: c.lead_id, rect: e.currentTarget.getBoundingClientRect() })}
              aria-label={tag ? `เปลี่ยนแท็ก (${tag.label})` : "เลือกแท็ก"}
              className="inline-flex items-center gap-1 rounded transition-colors"
            >
              {tag ? <TagChip tag={tag} /> : (
                <span className="inline-flex items-center gap-1 rounded border border-dashed border-border-strong px-1.5 text-label text-text-subtle hover:text-accent hover:border-accent transition-colors">
                  <Plus size={10} strokeWidth={2} /> แท็ก
                </span>
              )}
            </button>
          </span>
        );
      } },
    { key: "sale", label: "เซล", cell: (c) => <Val mono>{c.sale_id}</Val> },
    { key: "listing_code", label: "ทรัพย์ที่สนใจ", cell: (c) => <Val mono>{c.listing_code}</Val>,
      add: { field: "listing_code", editor: { as: "text" }, placeholder: "รหัสทรัพย์" } },
    { key: "marketing_channel", label: "ช่องทาง", width: 120, cell: (c) => <Val>{c.marketing_channel}</Val> },
    { key: "budget", label: "งบประมาณ", align: "right", width: 110,
      cell: (c) => <Val mono>{c.budget != null ? formatBaht(c.budget) : null}</Val> },
    { key: "commission", label: "คอมมิชชั่น", align: "right", width: 110,
      cell: (c) => <Val mono>{c.commission ? formatBaht(c.commission) : null}</Val> },
    { key: "date_received", label: "วันที่รับ", align: "right",
      cell: (c) => <Val mono>{formatDate(c.date_received)}</Val> },
    { key: "follow", label: "ติดตามล่าสุด", align: "right", width: 116,
      cell: (c) => <Val mono>{formatDate(c.last_follow_date)}</Val>,
      // The grade decides the window, and a grade with no window paints
      // nothing — see ตั้งค่า → สีสถานะ & SLA.
      fill: (c) => slaFill(sla, c.potential, c.last_follow_date) },
    /* The three closing columns sit together: signed → transferred → what it sold
       for. A closed deal missing the price shows an amber "ยังไม่กรอก" rather than
       a blank, because a blank reads as "nothing to record here" and this is the
       one number nothing else in the database holds (lib/deals.ts). */
    { key: "closing_date", label: "วันที่ปิด", align: "right",
      cell: (c) => <Val mono>{formatDate(c.closing_date)}</Val> },
    { key: "transfer_date", label: "วันที่โอน", align: "right",
      cell: (c) => <Val mono>{formatDate(c.transfer_date)}</Val> },
    { key: "closing_price", label: "ราคาปิด", align: "right", width: 110,
      cell: (c) =>
        c.closing_price != null ? (
          <Val mono>{formatBaht(c.closing_price)}</Val>
        ) : isClosed(c) ? (
          <span className="text-amber">ยังไม่กรอก</span>
        ) : null },
    { key: "customer_complain", label: "ข้อร้องเรียน", width: 180, cell: (c) => <Dim>{c.customer_complain}</Dim> },
    { key: "complain_status", label: "สถานะร้องเรียน", cell: (c) => <Val>{c.complain_status}</Val> },
    { key: "complain_remark", label: "หมายเหตุร้องเรียน", width: 180, cell: (c) => <Dim>{c.complain_remark}</Dim> },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [colors, sla, leadTags, tagOverride]);

  /* Throwing rather than returning is what SheetTable's draft row expects: it
     keeps everything typed on screen and shows the message, so a refused
     create never also loses the row. */
  const addLead = async (draft: Record<string, string>) => {
    const res = await createLead({
      lead_name: draft.lead_name ?? "",
      phone: draft.phone ?? "",
      listing_code: draft.listing_code || undefined,
    });
    if (!res.ok) throw new Error(res.error);
    router.refresh();
  };

  const canCreate = can("leads.create");

  const grid = (data: CrmRow[], caption: string, withAdd = false) => (
    <SheetTable
      tableKey="leads"
      columns={columns}
      rows={data}
      rowKey={(c) => c.lead_id}
      // Hand the row to the drawer's loading state so it opens filled in rather than
      // shimmering, THEN navigate. See lib/peek.ts.
      onSelect={(c) => {
        stashLead(c);
        router.push(`/leads/${c.lead_id}`);
      }}
      onHover={(c) => router.prefetch(`/leads/${c.lead_id}`)}
      prefs={prefs}
      empty="ไม่พบรายการ"
      caption={caption}
      onCreate={withAdd && canCreate ? addLead : undefined}
      addHint="เกรด · สเตจ · งบ กรอกได้หลังเปิดรายการ"
    />
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
        <div className="ml-auto">
          <StageFilter value={stage} options={stageOptions} onChange={setStage} />
        </div>
      </div>

      {/* Grouping renders ONE GRID PER TAG rather than group header rows inside
          a single table: the grid's header is frozen and its rows are a fixed
          height, so a full-width heading row spliced into the body would sit
          under the sticky header and break the lattice both rely on. */}
      <CardContent className={cn("p-0", groups && "flex flex-col gap-3 p-3")}>
        {groups
          ? groups.map((g) => (
              <div key={g.tag?.id ?? "__untagged"}>
                <div className="mb-1.5 flex items-center gap-2">
                  {g.tag ? <TagChip tag={g.tag} /> : <span className="text-small text-text-subtle">ไม่มีแท็ก</span>}
                  <span className="num text-label text-text-subtle">({g.rows.length})</span>
                </div>
                {grid(g.rows, `แสดง ${g.rows.length} รายการ`)}
              </div>
            ))
          : grid(rows, `แสดง ${rows.length} จาก ${crm.length} รายการ`, true)}
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
