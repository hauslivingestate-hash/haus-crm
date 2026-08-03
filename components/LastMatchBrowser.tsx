"use client";

import * as React from "react";
import { Search } from "lucide-react";
import {
  type LastMatch,
  type CloseType,
  closeTypeTone,
  sizeSummary,
  matchScope,
  scopeMatches,
} from "@/lib/lastMatch";
import { useRbac } from "@/components/RbacProvider";
import { visibleMemberIds } from "@/lib/teams";
import { getEmployee } from "@/lib/team";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { SortHeader, useSort } from "@/components/ui/SortHeader";
import { compareValues, orderIndex } from "@/lib/sort";
import { formatBaht, formatThaiDate } from "@/lib/format";
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
  agent: (m) => m.sale_id,
};

export function LastMatchBrowser({ matches: all }: { matches: LastMatch[] }) {
  const [q, setQ] = React.useState("");
  const [close, setClose] = React.useState<"all" | CloseType>("all");
  const { sort, onSort } = useSort({ key: "date", dir: "desc" });
  const { can, currentUser, teams } = useRbac();

  // ── Scope: own → team → all (CEO feedback R1). Resolved from permissions, then mapped
  // from user ids to the employee codes (S-00x) the ledger's `sale_id` actually stores.
  const scope = matchScope(can);
  const matches = React.useMemo(() => {
    if (scope === "all") return all;
    if (scope === "none") return [];
    // "team" reuses the existing team-scoping helper (a leader sees their team, everyone
    // else just themselves); "own" is always just the viewer.
    const memberIds =
      scope === "team"
        ? (visibleMemberIds(teams, currentUser.id, false) ?? new Set([currentUser.id]))
        : new Set([currentUser.id]);
    const codes = new Set(
      [...memberIds].map((id) => getEmployee(id)?.code).filter((c): c is string => !!c)
    );
    return scopeMatches(all, codes);
  }, [all, scope, teams, currentUser.id]);

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
                    {formatThaiDate(m.date_created)}
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
                    {formatBaht(m.last_match_price)}
                  </TD>
                  <TD>
                    {m.close_type ? (
                      <Pill tone={closeTypeTone(m.close_type)}>{m.close_type}</Pill>
                    ) : (
                      <span className="text-text-subtle">—</span>
                    )}
                  </TD>
                  {showAgent && <TD className="num text-small text-text-muted">{m.sale_id ?? "—"}</TD>}
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
