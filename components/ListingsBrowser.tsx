"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Building2 } from "lucide-react";
import type { ListingRow } from "@/lib/queries";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useSort } from "@/components/ui/SortHeader";
import { SheetTable, Val, Dim, Yes } from "@/components/ui/SheetTable";
import type { SheetColumn, TablePrefs } from "@/lib/tables";
import { lookupFill, slaFill, type LookupColors } from "@/lib/tables/fills";
import { ownerStageMeta } from "@/lib/ownerPipeline";
import type { SlaWindows } from "@/lib/sla";
import { formatBaht, formatRent, formatNumber, daysOnMarketLabel } from "@/lib/format";
import { potentialTone, potentialGroup, type PotentialGroup } from "@/lib/status";
import { compareValues, orderIndex } from "@/lib/sort";
import { cn } from "@/lib/cn";
import { useMasterData } from "@/components/MasterDataProvider";
import { useRbac } from "@/components/RbacProvider";
import { createListing } from "@/lib/mutations/listings";

// Stable, sensible chip order — only statuses actually present get a chip.
const STATUS_ORDER = [
  "Posted",
  "Ready to Post",
  "Update",
  "Need Info",
  "Sold",
  "Sold Completed",
  "Cancel",
  "Cancel Completed",
];

// Focus tiers — the high-value "potential" grades that get extra cross-team
// attention. Active chip uses the tier's own tone so the filter itself signals priority.
const POT_CHIPS: { key: PotentialGroup; label: string; active: string }[] = [
  { key: "exclusive", label: "Exclusive", active: "bg-accent-wash text-accent border-accent" },
  { key: "a_list", label: "A-List", active: "bg-amber-bg text-amber border-amber" },
];

// Sort-value extractors. Categorical columns return a numeric rank so they
// order by meaning (Exclusive → A-List → Normal), not alphabetically.
const SORT_VALUE: Record<string, (l: ListingRow) => number | string | null> = {
  listing_id: (l) => l.listing_id,
  name: (l) => l.listing_name,
  zone: (l) => l.zone_name_thai ?? l.zone,
  area: (l) => l.area_sqm,
  potential: (l) => {
    if (l.potential == null) return null;
    const t = potentialTone(l.potential);
    return t === "accent" ? 0 : t === "amber" ? 1 : 2;
  },
  status: (l) => orderIndex(STATUS_ORDER, l.listing_status),
  price: (l) => l.asking_price ?? l.rental_price,
  dom: (l) => l.days_on_market,
};

export function ListingsBrowser({
  listings,
  covers = {},
  prefs,
  colors,
  sla,
}: {
  listings: ListingRow[];
  /** listing_id → cover photo URL. Absent = no photo uploaded yet, which the Cover
   *  component draws as a building icon rather than a stock photo of someone else's house. */
  covers?: Record<string, string>;
  /** This viewer's saved column layout. Undefined = never opened the manager. */
  prefs?: TablePrefs;
  /** Admin-chosen colour per lookup value — ตั้งค่า → ข้อมูลอ้างอิงกลาง. */
  colors: LookupColors;
  /** Listing grade → owner-talk window in days. Missing/null = no SLA. */
  sla: SlaWindows;
}) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [filter, setFilter] = React.useState("all");
  const [potFilter, setPotFilter] = React.useState<"all" | PotentialGroup>("all");
  // Sort STATE is kept — it still orders the rows handed to the grid. What is
  // gone is the clickable header: SheetTable has no sort affordance, because a
  // header sort that disagrees with the filter chips above it is its own bug.
  // Re-adding sorting is a deliberate piece of work, not a leftover.
  const { sort } = useSort();
  const { propertyTypes, zones } = useMasterData();
  const { can } = useRbac();

  const chips = [
    { key: "all", label: "ทั้งหมด" },
    ...STATUS_ORDER.filter((s) => listings.some((l) => l.listing_status === s)).map((s) => ({
      key: s,
      label: s,
    })),
  ];

  // Only show a focus chip for a tier that actually has listings.
  const potChips = POT_CHIPS.filter((c) =>
    listings.some((l) => potentialGroup(l.potential) === c.key)
  );

  const query = q.trim().toLowerCase();
  const filtered = listings
    .filter((l) => filter === "all" || l.listing_status === filter)
    .filter((l) => potFilter === "all" || potentialGroup(l.potential) === potFilter)
    .filter(
      (l) =>
        !query ||
        [l.listing_name, l.project_name_eng, l.zone_name_thai, l.zone, l.listing_id].some((v) =>
          v?.toLowerCase().includes(query)
        )
    );

  const sortFn = SORT_VALUE[sort.key];
  const rows = sortFn
    ? [...filtered].sort((a, b) => compareValues(sortFn(a), sortFn(b), sort.dir))
    : filtered;

  /* THE COLUMN REGISTRY. Lives here rather than in lib/ because a cell may
     need anything this component has — `covers` is the reason today, hooks
     will be the reason tomorrow.

     Every field `v_main_listing` exposes gets a column. That is the point of
     the grid: the old table showed 10 of 55 and the other 45 were reachable
     only by opening a record one at a time. Nobody has to look at all of them
     — the column manager is what makes 40 columns a library rather than a
     wall, and the default hidden set is nobody's job to guess. */
  const columns = React.useMemo<SheetColumn<ListingRow>[]>(() => [
    { key: "listing_id", label: "Listing ID", locked: true, width: 104,
      cell: (l) => <span className="num text-accent">{l.listing_id}</span> },
    { key: "name", label: "โครงการ", width: 210,
      cell: (l) => (
        <span className="flex items-center gap-2">
          <Cover src={covers[l.listing_id]} compact />
          <span className="truncate">{l.listing_name ?? l.project_name_eng ?? "—"}</span>
        </span>
      ) },
    { key: "status", label: "สถานะ", width: 116,
      cell: (l) => <Val>{l.listing_status}</Val>,
      fill: (l) => lookupFill(colors.listing_status, l.listing_status) },
    // The OWNER pipeline, next to the advert's status so the two are read as the
    // different things they are (lib/ownerPipeline.ts). Appended to the registry, so
    // resolve() shows it to everyone who has not hidden it.
    { key: "owner_stage", label: "ไปป์ไลน์เจ้าของ", width: 128,
      cell: (l) => <Val>{ownerStageMeta(l.owner_stage).label}</Val> },
    { key: "potential", label: "Potential", width: 96,
      cell: (l) => <Val>{l.potential}</Val>,
      fill: (l) => lookupFill(colors.listing_potential, l.potential) },
    { key: "listing_type", label: "ประเภทประกาศ", cell: (l) => <Val>{l.listing_type}</Val> },
    { key: "owner_focus", label: "โฟกัส", align: "center", cell: (l) => <Yes on={l.owner_focus ?? undefined} /> },
    { key: "property_type", label: "ประเภททรัพย์", cell: (l) => <Val>{l.property_type}</Val>,
      // Required, and not for validation's sake: the listing_id trigger builds
      // the code from this letter plus the zone and RAISES without either.
      add: { field: "property_type", editor: { as: "select", choices: propertyTypes.map((t) => ({ value: t.id, label: t.label })) }, required: true, placeholder: "เลือกประเภท" } },
    { key: "zone", label: "โซน", width: 130,
      cell: (l) => <Val>{l.zone_name_thai ?? l.zone}</Val>,
      add: { field: "zone", editor: { as: "select", choices: zones.map((z) => ({ value: z.id, label: z.label })) }, required: true, placeholder: "เลือกโซน" } },
    { key: "in_out_project", label: "ใน/นอกโครงการ", cell: (l) => <Dim>{l.in_out_project}</Dim> },
    { key: "road_soi", label: "ถนน/ซอย", width: 140, cell: (l) => <Dim>{l.road_soi}</Dim> },
    { key: "unit_no", label: "เลขห้อง", cell: (l) => <Val mono>{l.unit_no}</Val>,
      add: { field: "unit_no", editor: { as: "text" } } },
    { key: "building", label: "อาคาร", cell: (l) => <Val>{l.building}</Val> },
    { key: "floor", label: "ชั้น", cell: (l) => <Val mono>{l.floor}</Val> },
    { key: "bed", label: "นอน", align: "right", cell: (l) => <Val mono>{l.bed}</Val> },
    { key: "bath", label: "น้ำ", align: "right", cell: (l) => <Val mono>{l.bath}</Val> },
    { key: "area_sqm", label: "ตร.ม.", align: "right",
      cell: (l) => <Val mono>{l.area_sqm != null ? formatNumber(l.area_sqm) : null}</Val> },
    { key: "area_wa", label: "ตร.ว.", align: "right",
      cell: (l) => <Val mono>{l.area_wa != null ? formatNumber(l.area_wa) : null}</Val> },
    { key: "parking", label: "จอดรถ", align: "right", cell: (l) => <Val mono>{l.parking}</Val> },
    { key: "direction", label: "ทิศ", cell: (l) => <Val>{l.direction}</Val> },
    { key: "view_type", label: "วิว", cell: (l) => <Val>{l.view_type}</Val> },
    { key: "unit_position", label: "ตำแหน่งห้อง", cell: (l) => <Val>{l.unit_position}</Val> },
    { key: "unit_condition", label: "สภาพ", cell: (l) => <Val>{l.unit_condition}</Val> },
    { key: "asking_price", label: "ราคาขาย", align: "right", width: 116,
      cell: (l) => <Val mono>{l.asking_price != null ? formatBaht(l.asking_price) : null}</Val>,
      add: { field: "asking_price", editor: { as: "money" } } },
    { key: "rental_price", label: "ราคาเช่า", align: "right", width: 110,
      cell: (l) => <Val mono>{l.rental_price != null ? formatRent(l.rental_price) : null}</Val> },
    { key: "old_price", label: "ราคาเดิม", align: "right",
      cell: (l) => <Dim>{l.old_price != null ? formatBaht(l.old_price) : null}</Dim> },
    { key: "price_remark", label: "หมายเหตุราคา", width: 150, cell: (l) => <Dim>{l.price_remark}</Dim> },
    { key: "dom", label: "DOM", align: "right",
      cell: (l) => <Val mono>{daysOnMarketLabel(l.days_on_market)}</Val> },
    { key: "owner_name", label: "เจ้าของ", width: 140, cell: (l) => <Val>{l.owner_name}</Val> },
    { key: "owner_phone", label: "เบอร์เจ้าของ", cell: (l) => <Val mono>{l.owner_phone}</Val> },
    { key: "owner_talk_last_date", label: "คุยเจ้าของล่าสุด", align: "right", width: 130,
      cell: (l) => <Val mono>{l.owner_talk_last_date}</Val>,
      // The listing grade's window — Exclusive gets chased harder than Normal,
      // if and only if someone has set a number for it.
      fill: (l) => slaFill(sla, l.potential, l.owner_talk_last_date) },
    { key: "sale_id", label: "เซล",
      cell: (l) => <Val mono>{l.effective_sale_id ?? l.sale_id}</Val> },
    { key: "sign", label: "ป้าย", align: "center", cell: (l) => <Yes on={l.sign ?? undefined} /> },
    { key: "vdo", label: "วิดีโอ", align: "center", cell: (l) => <Yes on={l.vdo ?? undefined} /> },
    { key: "ddproperty_link", label: "DD", align: "center", cell: (l) => <Yes on={Boolean(l.ddproperty_link)} /> },
    { key: "livinginsider_link", label: "LV", align: "center", cell: (l) => <Yes on={Boolean(l.livinginsider_link)} /> },
    { key: "propertyhub_link", label: "PH", align: "center", cell: (l) => <Yes on={Boolean(l.propertyhub_link)} /> },
    { key: "agreement_end", label: "สัญญาถึง", align: "right", cell: (l) => <Val mono>{l.agreement_end}</Val> },
    { key: "date_created", label: "วันที่ลง", align: "right", cell: (l) => <Val mono>{l.date_created}</Val> },
    { key: "remark", label: "หมายเหตุ", width: 200, cell: (l) => <Dim>{l.remark}</Dim> },
  ], [covers, colors, sla, propertyTypes, zones]);

  /* Throwing rather than returning keeps the typed values on screen when a
     create is refused — losing four filled fields to an error message is what
     makes an inline row feel worse than the form it replaced. */
  const addListing = async (draft: Record<string, string>) => {
    const res = await createListing({
      project_id: "",
      values: {
        property_type: draft.property_type ?? "",
        zone: draft.zone ?? "",
        unit_no: draft.unit_no || null,
        // The money editor allows grouping separators through; the column is
        // numeric, so they have to come off before it reaches Postgres.
        asking_price: draft.asking_price ? draft.asking_price.replace(/,/g, "") : null,
      },
    });
    if (!res.ok) throw new Error(res.error);
    router.refresh();
  };

  return (
    <Card>
      {/* Toolbar: search + status filter chips */}
      <div className="flex items-center gap-2.5 p-3 border-b border-border flex-wrap">
        <div className="relative w-full sm:w-auto">
          <Search
            size={14}
            strokeWidth={1.75}
            className="text-text-subtle absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหาโครงการ / ทำเล / รหัส…"
            className="w-full sm:w-64 pl-8"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap ml-auto items-center">
          {chips.map((c) => {
            const n =
              c.key === "all"
                ? listings.length
                : listings.filter((l) => l.listing_status === c.key).length;
            return (
              <button
                key={c.key}
                onClick={() => setFilter(c.key)}
                className={cn(
                  "text-small font-medium rounded-md px-3 py-1.5 border transition-colors",
                  filter === c.key
                    ? "bg-text text-background border-text"
                    : "border-border-strong text-text-muted hover:bg-surface-2"
                )}
              >
                {c.label} <span className="num">({n})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Focus filter — high-value potential tiers (Exclusive / A-List) */}
      {potChips.length > 0 && (
        <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-border flex-wrap">
          <span className="text-label text-text-subtle mr-1">โฟกัส</span>
          <button
            onClick={() => setPotFilter("all")}
            className={cn(
              "text-small font-medium rounded-md px-3 py-1.5 border transition-colors",
              potFilter === "all"
                ? "bg-text text-background border-text"
                : "border-border-strong text-text-muted hover:bg-surface-2"
            )}
          >
            ทั้งหมด
          </button>
          {potChips.map((c) => {
            const n = listings.filter((l) => potentialGroup(l.potential) === c.key).length;
            return (
              <button
                key={c.key}
                onClick={() => setPotFilter(potFilter === c.key ? "all" : c.key)}
                className={cn(
                  "text-small font-medium rounded-md px-3 py-1.5 border transition-colors",
                  potFilter === c.key
                    ? c.active
                    : "border-border-strong text-text-muted hover:bg-surface-2"
                )}
              >
                {c.label} <span className="num">({n})</span>
              </button>
            );
          })}
        </div>
      )}

      <CardContent className="p-0">
        <SheetTable
          tableKey="listings"
          columns={columns}
          rows={rows}
          rowKey={(l) => l.listing_id}
          onSelect={(l) => router.push(`/listings/${l.listing_id}`)}
          onHover={(l) => router.prefetch(`/listings/${l.listing_id}`)}
          prefs={prefs}
          empty="ไม่พบทรัพย์"
          caption={`แสดง ${rows.length} จาก ${listings.length} รายการ`}
          onCreate={can("listings.create") ? addListing : undefined}
          addHint="รหัสทรัพย์สร้างอัตโนมัติจากประเภท + โซน · ที่เหลือกรอกได้หลังเปิดรายการ"
        />
      </CardContent>
    </Card>
  );
}

/** Listing cover thumbnail — shows the photo when available, else a fallback
 *  icon. HAUS has no listing photos yet, so this currently always falls back;
 *  pass `src` once cover images are wired. */
function Cover({ src, compact }: { src?: string | null; compact?: boolean }) {
  return (
    <span className={cn(
      "shrink-0 rounded overflow-hidden bg-surface-2 border border-border grid place-items-center",
      // The grid's row is 30px tall, so the thumbnail has to fit inside it —
      // a 36px cover would set the row height and break the lattice.
      compact ? "h-[18px] w-[26px]" : "h-9 w-12",
    )}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <Building2 size={compact ? 11 : 16} strokeWidth={1.75} className="text-text-subtle" />
      )}
    </span>
  );
}
