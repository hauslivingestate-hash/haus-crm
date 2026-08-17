"use client";

import * as React from "react";
import { Search } from "lucide-react";
import {
  type LastMatch,
  type CloseType,
  closeTypeTone,
  sizeSummary,
  matchScope,
} from "@/lib/lastMatch";
import { useRbac } from "@/components/RbacProvider";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { useRouter } from "next/navigation";
import { setMatchPrice } from "@/lib/mutations/lastMatch";
import { SortHeader, useSort } from "@/components/ui/SortHeader";
import { compareValues, orderIndex } from "@/lib/sort";
import { formatBaht, formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";

const CLOSE_TYPES: CloseType[] = [
  "ปิดเอง",
  "เจ้าของขายเอง",
  "เอเจ้นอื่นสอยไป",
  "มือ 1",
  "ไม่รู้",
];

// Categorical sort ranks by meaning, not alphabetically.
const SORT_VALUE: Record<string, (m: LastMatch) => number | string | null> = {
  date: (m) => m.date_created,
  project: (m) => m.project_name,
  zone: (m) => m.zone_name_thai,
  price: (m) => m.last_match_price,
  close: (m) => orderIndex(CLOSE_TYPES, m.close_type),
  agent: (m) => m.sale_name,
};

export function LastMatchBrowser({ matches }: { matches: LastMatch[] }) {
  const router = useRouter();
  const [, startRefresh] = React.useTransition();
  const refresh = React.useCallback(() => startRefresh(() => router.refresh()), [router]);
  const [q, setQ] = React.useState("");
  const [close, setClose] = React.useState<"all" | CloseType>("all");
  const { sort, onSort } = useSort({ key: "date", dir: "desc" });
  const { can } = useRbac();

  // ── Scope: own → team → all (CEO feedback R1) — enforced by RLS on the query, so the
  // rows arriving here are already the viewer's. What's left for the permission to decide
  // is presentation: whether a เซลส์ column earns its place, and whether an empty result
  // means "no access" or "nothing closed yet".
  //
  // The client-side re-filter this replaced compared seed user ids against seed employee
  // codes; with real sessions it matched nothing and would have blanked the table.
  const scope = matchScope(can);
  // Back-filling a closing price is the whole reason this page is editable: all 56 imported
  // deals arrived with none, and that single blank column is what keeps the dashboard
  // parked. Writing is gated on lastmatch.add, matching the table's policies.
  const canEditPrice = can("lastmatch.add") || can("roles.manage");

  const query = q.trim().toLowerCase();
  const filtered = matches
    .filter((m) => close === "all" || m.close_type === close)
    .filter(
      (m) =>
        !query ||
        (m.project_name ?? "").toLowerCase().includes(query) ||
        (m.zone_name_thai ?? "").toLowerCase().includes(query) ||
        (m.last_match_remark ?? "").toLowerCase().includes(query)
    );

  const sortFn = SORT_VALUE[sort.key];
  const list = sortFn
    ? [...filtered].sort((a, b) => compareValues(sortFn(a), sortFn(b), sort.dir))
    : filtered;

  const chips: { key: "all" | CloseType; label: string }[] = [
    { key: "all", label: "ทั้งหมด" },
    ...CLOSE_TYPES.map((t) => ({ key: t, label: t })),
  ];

  // Only worth a เซลส์ column when the viewer can actually see more than one person's rows.
  const showAgent = scope === "all" || scope === "team";

  if (scope === "none") {
    return (
      <Card>
        <div className="p-10 text-center text-small text-text-subtle">
          คุณไม่มีสิทธิ์ดู Last Match
        </div>
      </Card>
    );
  }

  return (
    <Card>
      {/* Toolbar */}
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
            placeholder="ค้นหาโครงการ / โซน / หมายเหตุ…"
            className="w-full sm:w-72 pl-8"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap ml-auto">
          {chips.map((c) => {
            const n =
              c.key === "all"
                ? matches.length
                : matches.filter((m) => m.close_type === c.key).length;
            return (
              <button
                key={c.key}
                onClick={() => setClose(c.key)}
                className={cn(
                  "text-small font-medium rounded-md px-3 py-1.5 border transition-colors",
                  close === c.key
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

      {list.length === 0 ? (
        <div className="p-10 text-center text-small text-text-subtle">ไม่พบข้อมูล</div>
      ) : (
        <CardContent className="p-0">
          <Table className="min-w-[920px]">
            <THead>
              <TR>
                <SortHeader label="วันที่" sortKey="date" sort={sort} onSort={onSort} defaultDir="desc" />
                <SortHeader label="โครงการ" sortKey="project" sort={sort} onSort={onSort} />
                <SortHeader label="โซน" sortKey="zone" sort={sort} onSort={onSort} />
                <TH>ขนาด</TH>
                <TH>ห้อง</TH>
                <SortHeader label="ราคาปิด" sortKey="price" sort={sort} onSort={onSort} align="right" defaultDir="desc" />
                <SortHeader label="ประเภทการปิด" sortKey="close" sort={sort} onSort={onSort} />
                {/* Own-scoped viewers see only their own rows — a column repeating their own
                    name (and a sort on it) is noise. */}
                {showAgent && <SortHeader label="เซลส์" sortKey="agent" sort={sort} onSort={onSort} />}
                <TH>หมายเหตุ</TH>
              </TR>
            </THead>
            <TBody>
              {list.map((m) => (
                <TR key={m.last_match_id}>
                  <TD className="num text-small text-text-muted whitespace-nowrap">
                    {formatDate(m.date_created)}
                  </TD>
                  <TD>
                    <div className="font-medium">{m.project_name ?? "—"}</div>
                    <div className="text-label text-text-subtle">{m.property_type ?? "—"}</div>
                  </TD>
                  <TD className="text-small text-text-muted whitespace-nowrap">
                    {m.zone_name_thai ?? "—"}
                    {m.zone && <span className="num text-text-subtle ml-1">{m.zone}</span>}
                  </TD>
                  <TD className="num text-small text-text-muted whitespace-nowrap">{sizeSummary(m)}</TD>
                  <TD className="num text-small text-text-muted whitespace-nowrap">
                    {m.bed != null || m.bath != null ? `${m.bed ?? "—"}/${m.bath ?? "—"}` : "—"}
                  </TD>
                  <TD className="num text-right font-semibold whitespace-nowrap">
                    {canEditPrice ? (
                      <PriceCell match={m} onSaved={refresh} />
                    ) : (
                      formatBaht(m.last_match_price)
                    )}
                  </TD>
                  <TD>
                    {m.close_type ? (
                      <Pill tone={closeTypeTone(m.close_type)}>{m.close_type}</Pill>
                    ) : (
                      <span className="text-text-subtle">—</span>
                    )}
                  </TD>
                  {showAgent && <TD className="text-small text-text-muted">{m.sale_name ?? "—"}</TD>}
                  <TD className="text-small text-text-muted max-w-[220px]">
                    <span className="line-clamp-1">{m.last_match_remark ?? "—"}</span>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      )}
    </Card>
  );
}

/**
 * The price, editable in place.
 *
 * Committed on blur rather than per keystroke — "35" is not a price, and this number feeds
 * the revenue figures. Shows "—" until one exists so a blank reads as missing rather than
 * as zero.
 */
function PriceCell({ match, onSaved }: { match: LastMatch; onSaved: () => void }) {
  const [value, setValue] = React.useState(
    match.last_match_price != null ? String(match.last_match_price) : ""
  );
  const [busy, setBusy] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    setValue(match.last_match_price != null ? String(match.last_match_price) : "");
  }, [match.last_match_price]);

  const commit = async () => {
    const raw = value.replace(/[^\d.]/g, "");
    const next = raw === "" ? null : Number(raw);
    if (next === match.last_match_price) return;
    setBusy(true);
    setFailed(false);
    try {
      const res = await setMatchPrice(match.last_match_id, next, match.last_match_remark);
      if (!res.ok) {
        setFailed(true);
        setValue(match.last_match_price != null ? String(match.last_match_price) : "");
      } else {
        onSaved();
      }
    } catch {
      setFailed(true);
      setValue(match.last_match_price != null ? String(match.last_match_price) : "");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Input
      value={value}
      disabled={busy}
      onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ""))}
      onBlur={() => void commit()}
      inputMode="numeric"
      placeholder="—"
      aria-label={`ราคาปิดของ ${match.project_name ?? match.last_match_id}`}
      className={cn(
        "num text-right h-8 w-32",
        failed && "border-red",
        match.last_match_price == null && "text-text-subtle"
      )}
    />
  );
}
