"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Building2, Phone, Users, ChevronDown, Check, ListFilter, Star } from "lucide-react";
import type { ListingRow } from "@/lib/queries";
import type { Employee } from "@/lib/team";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Avatar } from "@/components/ui/Avatar";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { SortHeader, useSort } from "@/components/ui/SortHeader";
import { StatusBadge } from "@/components/ui/Dot";
import { Pill } from "@/components/ui/Pill";
import { formatBaht, formatRent, formatNumber } from "@/lib/format";
import { listingStatusDot, potentialTone, potentialGroup } from "@/lib/status";
import { compareValues, orderIndex } from "@/lib/sort";
import { listingAgent } from "@/lib/listings";
import { cn } from "@/lib/cn";
import { listingCoverImage } from "@/lib/placeholderImages"; // PREVIEW ONLY — fake listing photos

const STATUS_ORDER = [
  "Posted", "Ready to Post", "Update", "Need Info",
  "Sold", "Sold Completed", "Cancel", "Cancel Completed",
];

// High-value focus tiers (potential) — ordered Exclusive → A-List.
const POT_GROUPS = [
  { key: "exclusive", label: "Exclusive" },
  { key: "a_list", label: "A-List" },
];

// Listing + its managing sales agent (design-first seed). NO owner data is surfaced here —
// this is the company-wide co-agent view; owner contact stays on the detail page, gated.
interface Row extends ListingRow {
  agent: Employee | undefined;
}

const SORT_VALUE: Record<string, (l: Row) => number | string | null> = {
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
  agent: (l) => l.agent?.nickname ?? null,
};

export function CompanyListings({ listings }: { listings: ListingRow[] }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [potFilter, setPotFilter] = React.useState("all");
  const [agentNick, setAgentNick] = React.useState<string>("all");
  const { sort, onSort } = useSort();

  const rows: Row[] = React.useMemo(
    () => listings.map((l) => ({ ...l, agent: listingAgent(l.listing_id) })),
    [listings]
  );

  // Per-agent totals across the whole company (independent of status/search) — feeds the
  // agent-filter dropdown, sorted by who holds the most inventory. Scales to any headcount.
  const agentCounts = React.useMemo(() => {
    const m = new Map<string, { agent: Employee; count: number }>();
    for (const r of rows) {
      if (!r.agent) continue;
      const cur = m.get(r.agent.nickname);
      if (cur) cur.count++;
      else m.set(r.agent.nickname, { agent: r.agent, count: 1 });
    }
    return [...m.values()].sort((a, b) => b.count - a.count);
  }, [rows]);

  const statusOptions: FilterOption[] = [
    { key: "all", label: "ทุกสถานะ", count: rows.length },
    ...STATUS_ORDER.filter((s) => rows.some((l) => l.listing_status === s)).map((s) => ({
      key: s,
      label: s,
      count: rows.filter((l) => l.listing_status === s).length,
    })),
  ];

  const focusOptions: FilterOption[] = [
    { key: "all", label: "ทุกระดับ", count: rows.length },
    ...POT_GROUPS.filter((g) => rows.some((l) => potentialGroup(l.potential) === g.key)).map((g) => ({
      key: g.key,
      label: g.label,
      count: rows.filter((l) => potentialGroup(l.potential) === g.key).length,
    })),
  ];

  const agentOptions: FilterOption[] = [
    { key: "all", label: "ทุกเซล", count: rows.length },
    ...agentCounts.map(({ agent, count }) => ({
      key: agent.nickname,
      label: agent.nickname,
      count,
      leading: <Avatar name={agent.nickname} src={agent.avatarUrl} tone="crimson" className="h-5 w-5" />,
    })),
  ];
  const currentAgent = agentOptions.find((o) => o.key === agentNick);

  const query = q.trim().toLowerCase();
  const filtered = rows
    .filter((l) => status === "all" || l.listing_status === status)
    .filter((l) => potFilter === "all" || potentialGroup(l.potential) === potFilter)
    .filter((l) => agentNick === "all" || l.agent?.nickname === agentNick)
    .filter(
      (l) =>
        !query ||
        [l.listing_name, l.project_name_eng, l.zone_name_thai, l.zone, l.listing_id, l.agent?.nickname].some(
          (v) => v?.toLowerCase().includes(query)
        )
    );

  const sortFn = SORT_VALUE[sort.key];
  const list = sortFn ? [...filtered].sort((a, b) => compareValues(sortFn(a), sortFn(b), sort.dir)) : filtered;

  return (
    <Card>
      {/* Toolbar: search + status/agent filters (matching component style) */}
      <div className="flex items-center gap-2.5 p-3 border-b border-border flex-wrap">
        <div className="relative w-full sm:w-auto">
          <Search size={14} strokeWidth={1.75} className="text-text-subtle absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาโครงการ / ทำเล / รหัส / เซล…" className="w-full sm:w-64 pl-8" />
        </div>
        <div className="text-small text-text-subtle">
          <span className="num text-text-muted">{list.length.toLocaleString("en-US")}</span> ทรัพย์
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <FilterDropdown
            icon={<Star size={14} strokeWidth={1.75} />}
            title="โฟกัส"
            value={potFilter}
            options={focusOptions}
            onChange={setPotFilter}
          />
          <FilterDropdown
            icon={<Users size={14} strokeWidth={1.75} />}
            title="ผู้ดูแล"
            value={agentNick}
            options={agentOptions}
            onChange={setAgentNick}
            activeLeading={currentAgent?.leading}
            menuClassName="w-60"
          />
          <FilterDropdown
            icon={<ListFilter size={14} strokeWidth={1.75} />}
            title="สถานะ"
            value={status}
            options={statusOptions}
            onChange={setStatus}
          />
        </div>
      </div>

      <CardContent className="p-0">
        {list.length === 0 ? (
          <div className="p-10 text-center text-small text-text-subtle">ไม่พบทรัพย์</div>
        ) : (
          <Table className="min-w-[1120px] whitespace-nowrap">
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
                <SortHeader label="ผู้ดูแล" sortKey="agent" sort={sort} onSort={onSort} />
                <TH>ติดต่อเซล</TH>
              </TR>
            </THead>
            <TBody>
              {list.map((l) => (
                <TR key={l.listing_id} className="cursor-pointer" onClick={() => router.push(`/listings/${l.listing_id}`)}>
                  <TD className="num text-small text-accent font-medium">
                    <Link href={`/listings/${l.listing_id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
                      {l.listing_id}
                    </Link>
                  </TD>
                  <TD>
                    <div className="flex items-center gap-2.5">
                      <Cover src={listingCoverImage(l.listing_id)} />
                      <div className="min-w-0">
                        <div className="font-medium truncate">{l.listing_name ?? "—"}</div>
                        <div className="text-label text-text-subtle truncate">{l.project_name_eng}</div>
                      </div>
                    </div>
                  </TD>
                  <TD className="text-small text-text-muted">
                    {l.zone_name_thai}
                    <span className="num text-text-subtle ml-1">{l.zone}</span>
                  </TD>
                  <TD className="text-small">{l.property_type}</TD>
                  <TD className="text-right num text-small">
                    {l.bed ?? "—"}<span className="text-text-subtle">น</span> {l.bath ?? "—"}<span className="text-text-subtle">บ</span>
                  </TD>
                  <TD className="text-right num text-small">
                    {l.area_sqm ? `${formatNumber(l.area_sqm)}` : "—"}<span className="text-text-subtle"> ตร.ม.</span>
                  </TD>
                  <TD><Pill tone={potentialTone(l.potential)}>{l.potential}</Pill></TD>
                  <TD><StatusBadge color={listingStatusDot(l.listing_status)}>{l.listing_status}</StatusBadge></TD>
                  <TD className="text-right num">
                    {l.asking_price == null && l.rental_price == null ? (
                      <span className="text-text-subtle">—</span>
                    ) : (
                      <div className="flex flex-col items-end leading-tight">
                        {l.asking_price != null && (
                          <span className="font-medium"><span className="text-label text-text-subtle mr-1">ขาย</span>{formatBaht(l.asking_price)}</span>
                        )}
                        {l.rental_price != null && (
                          <span className="text-small text-text-muted"><span className="text-label text-text-subtle mr-1">เช่า</span>{formatRent(l.rental_price)}</span>
                        )}
                      </div>
                    )}
                  </TD>
                  <TD>
                    {l.agent ? (
                      <span className="inline-flex items-center gap-2">
                        <Avatar name={l.agent.nickname} src={l.agent.avatarUrl} tone="crimson" />
                        <span className="text-small text-text-muted num">{l.agent.nickname}</span>
                      </span>
                    ) : (
                      <span className="text-text-subtle">—</span>
                    )}
                  </TD>
                  <TD onClick={(e) => e.stopPropagation()} className="cursor-default">
                    {l.agent?.phone ? (
                      <a href={`tel:${l.agent.phone}`} className="num text-small text-text-muted hover:text-accent inline-flex items-center gap-1 transition-colors">
                        <Phone size={12} strokeWidth={1.75} />{l.agent.phone}
                      </a>
                    ) : (
                      <span className="text-text-subtle">—</span>
                    )}
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

// ── Shared filter dropdown — used for both สถานะ and ผู้ดูแล so they stay identical and
//    scale to any number of options (agents grow, status is fixed). ─────────────────────
interface FilterOption {
  key: string;
  label: string;
  count: number;
  leading?: React.ReactNode; // e.g. an agent avatar
}

function FilterDropdown({
  icon,
  title,
  value,
  options,
  onChange,
  activeLeading,
  menuClassName,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  options: FilterOption[];
  onChange: (k: string) => void;
  activeLeading?: React.ReactNode;
  menuClassName?: string;
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
        {active && activeLeading ? activeLeading : icon}
        <span>{title}{active ? `: ${current.label}` : ""}</span>
        <ChevronDown size={13} strokeWidth={2} className={cn("transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className={cn("absolute right-0 z-50 mt-1 w-56 rounded-lg border border-border bg-surface shadow-pop p-1 flex flex-col gap-0.5 max-h-80 overflow-y-auto", menuClassName)}>
            {options.map((o) => (
              <button
                key={o.key}
                onClick={() => { onChange(o.key); setOpen(false); }}
                className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-small hover:bg-surface-hover transition-colors text-left"
              >
                {o.leading && <span className="shrink-0">{o.leading}</span>}
                <span className={cn("truncate flex-1", o.key === value && "text-accent font-medium")}>{o.label}</span>
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

/** Listing cover thumbnail — photo when available, else a fallback icon. */
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
