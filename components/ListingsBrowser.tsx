"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Building2 } from "lucide-react";
import type { ListingRow } from "@/lib/queries";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { SortHeader, useSort } from "@/components/ui/SortHeader";
import { StatusBadge } from "@/components/ui/Dot";
import { Pill } from "@/components/ui/Pill";
import { formatBaht, formatRent, formatNumber, daysOnMarketLabel } from "@/lib/format";
import { listingStatusDot, potentialTone, potentialGroup, type PotentialGroup } from "@/lib/status";
import { compareValues, orderIndex } from "@/lib/sort";
import { cn } from "@/lib/cn";
import { listingCoverImage } from "@/lib/placeholderImages"; // PREVIEW ONLY — fake listing photos

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

export function ListingsBrowser({ listings }: { listings: ListingRow[] }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [filter, setFilter] = React.useState("all");
  const [potFilter, setPotFilter] = React.useState<"all" | PotentialGroup>("all");
  const { sort, onSort } = useSort();

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
        {rows.length === 0 ? (
          <div className="p-10 text-center text-small text-text-subtle">ไม่พบทรัพย์</div>
        ) : (
          <Table className="min-w-[920px]">
            <THead>
              <TR>
                <SortHeader label="Listing ID" sortKey="listing_id" sort={sort} onSort={onSort} />
                <SortHeader label="โครงการ" sortKey="name" sort={sort} onSort={onSort} />
                <SortHeader label="โซน" sortKey="zone" sort={sort} onSort={onSort} />
                <TH>ประเภท</TH>
                <TH className="text-right">ห้อง</TH>
                <SortHeader label="พื้นที่" sortKey="area" sort={sort} onSort={onSort} align="right" defaultDir="desc" />
                <SortHeader label="Potential" sortKey="potential" sort={sort} onSort={onSort} />
                <SortHeader label="สถานะ" sortKey="status" sort={sort} onSort={onSort} />
                <SortHeader label="ราคา" sortKey="price" sort={sort} onSort={onSort} align="right" defaultDir="desc" />
                <SortHeader label="DOM" sortKey="dom" sort={sort} onSort={onSort} align="right" defaultDir="desc" />
              </TR>
            </THead>
            <TBody>
              {rows.map((l) => (
                <TR
                  key={l.listing_id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/listings/${l.listing_id}`)}
                >
                  <TD className="num text-small text-accent font-medium">
                    <Link
                      href={`/listings/${l.listing_id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="hover:underline"
                    >
                      {l.listing_id}
                    </Link>
                  </TD>
                  <TD>
                    <div className="flex items-center gap-2.5">
                      <Cover src={listingCoverImage(l.listing_id)} />
                      <div className="min-w-0">
                        <div className="font-medium truncate">{l.listing_name ?? "—"}</div>
                        <div className="text-label text-text-subtle truncate">
                          {l.project_name_eng}
                        </div>
                      </div>
                    </div>
                  </TD>
                  <TD className="text-small text-text-muted">
                    {l.zone_name_thai}
                    <span className="num text-text-subtle ml-1">{l.zone}</span>
                  </TD>
                  <TD className="text-small">{l.property_type}</TD>
                  <TD className="text-right num text-small">
                    {l.bed ?? "—"}<span className="text-text-subtle">น</span> {l.bath ?? "—"}
                    <span className="text-text-subtle">บ</span>
                  </TD>
                  <TD className="text-right num text-small">
                    {l.area_sqm ? `${formatNumber(l.area_sqm)}` : "—"}
                    <span className="text-text-subtle"> ตร.ม.</span>
                  </TD>
                  <TD>
                    <Pill tone={potentialTone(l.potential)}>{l.potential}</Pill>
                  </TD>
                  <TD>
                    <StatusBadge color={listingStatusDot(l.listing_status)}>
                      {l.listing_status}
                    </StatusBadge>
                  </TD>
                  <TD className="text-right num">
                    {l.asking_price == null && l.rental_price == null ? (
                      <span className="text-text-subtle">—</span>
                    ) : (
                      <div className="flex flex-col items-end leading-tight">
                        {l.asking_price != null && (
                          <span className="font-medium">
                            <span className="text-label text-text-subtle mr-1">ขาย</span>
                            {formatBaht(l.asking_price)}
                          </span>
                        )}
                        {l.rental_price != null && (
                          <span className="text-small text-text-muted">
                            <span className="text-label text-text-subtle mr-1">เช่า</span>
                            {formatRent(l.rental_price)}
                          </span>
                        )}
                      </div>
                    )}
                  </TD>
                  <TD className="text-right num text-small text-text-muted">
                    {daysOnMarketLabel(l.days_on_market)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/** Listing cover thumbnail — shows the photo when available, else a fallback
 *  icon. HAUS has no listing photos yet, so this currently always falls back;
 *  pass `src` once cover images are wired. */
function Cover({ src }: { src?: string | null }) {
  return (
    <span className="h-9 w-12 shrink-0 rounded-md overflow-hidden bg-surface-2 border border-border grid place-items-center">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <Building2 size={16} strokeWidth={1.75} className="text-text-subtle" />
      )}
    </span>
  );
}
