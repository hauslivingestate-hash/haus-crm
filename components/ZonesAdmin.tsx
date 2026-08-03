"use client";

import * as React from "react";
import { Search, Pencil, UserRound } from "lucide-react";
import { type Zone } from "@/lib/zones";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { SortHeader, useSort } from "@/components/ui/SortHeader";
import { compareValues } from "@/lib/sort";

const SORT_VALUE: Record<string, (z: Zone) => number | string | null> = {
  code: (z) => z.zone_id,
  name: (z) => z.name_thai,
  assigned: (z) => z.sale_id_assigned,
};

export function ZonesAdmin({ zones }: { zones: Zone[] }) {
  const [q, setQ] = React.useState("");
  const { sort, onSort } = useSort();

  const query = q.trim().toLowerCase();
  const filtered = zones.filter(
    (z) =>
      !query ||
      z.zone_id.toLowerCase().includes(query) ||
      z.name_thai.toLowerCase().includes(query) ||
      z.name_eng.toLowerCase().includes(query)
  );
  const sortFn = SORT_VALUE[sort.key];
  const list = sortFn
    ? [...filtered].sort((a, b) => compareValues(sortFn(a), sortFn(b), sort.dir))
    : filtered;

  const assignedCount = zones.filter((z) => z.sale_id_assigned).length;

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
            placeholder="ค้นหาโซน / รหัส…"
            className="w-full sm:w-64 pl-8"
          />
        </div>
        <div className="text-small text-text-subtle ml-auto">
          มอบหมายแล้ว <span className="num text-text-muted">{assignedCount}</span>/
          <span className="num">{zones.length}</span> โซน
        </div>
      </div>

      {list.length === 0 ? (
        <div className="p-10 text-center text-small text-text-subtle">ไม่พบโซน</div>
      ) : (
        <CardContent className="p-0">
          <Table className="min-w-[560px]">
            <THead>
              <TR>
                <SortHeader label="รหัส" sortKey="code" sort={sort} onSort={onSort} />
                <SortHeader label="ชื่อโซน" sortKey="name" sort={sort} onSort={onSort} />
                <TH>ชื่ออังกฤษ</TH>
                <SortHeader label="เซลส์ที่ดูแล" sortKey="assigned" sort={sort} onSort={onSort} />
                <TH className="text-right">จัดการ</TH>
              </TR>
            </THead>
            <TBody>
              {list.map((z) => (
                <TR key={z.zone_id}>
                  <TD>
                    <span className="num font-medium">{z.zone_id}</span>
                  </TD>
                  <TD className="font-medium">{z.name_thai}</TD>
                  <TD className="text-small text-text-muted">{z.name_eng}</TD>
                  <TD>
                    {z.sale_id_assigned ? (
                      <span className="num inline-flex items-center gap-1.5 text-small text-text-muted">
                        <UserRound size={13} strokeWidth={1.75} className="text-text-subtle" />
                        {z.sale_id_assigned}
                      </span>
                    ) : (
                      <Pill tone="amber">ยังไม่มอบหมาย</Pill>
                    )}
                  </TD>
                  <TD className="text-right">
                    <button
                      disabled
                      aria-label="แก้ไขโซน"
                      className="inline-grid place-items-center size-7 rounded-md text-text-subtle opacity-50 cursor-not-allowed"
                    >
                      <Pencil size={14} strokeWidth={1.75} />
                    </button>
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
