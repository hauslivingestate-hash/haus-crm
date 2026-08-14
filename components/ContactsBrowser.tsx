"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import {
  type ContactSummary,
  type ContactRole,
  ROLE_LABEL,
  ROLE_TONE,
  normalizePhone,
} from "@/lib/contacts";
import { useRbac } from "@/components/RbacProvider";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import { Avatar } from "@/components/ui/Avatar";
import { Table, THead, TBody, TR, TD } from "@/components/ui/Table";
import { SortHeader, useSort } from "@/components/ui/SortHeader";
import { compareValues, orderIndex } from "@/lib/sort";
import { cn } from "@/lib/cn";

const ROLES = Object.keys(ROLE_LABEL) as ContactRole[];

// บทบาท (role) sorts by the contact's PRIMARY (first) role's rank, since a
// contact can hold several roles.
const SORT_VALUE: Record<string, (c: ContactSummary) => number | string | null> = {
  name: (c) => c.name,
  role: (c) => orderIndex(ROLES, c.roles[0]),
  phone: (c) => c.phone,
  line: (c) => c.line,
};

export function ContactsBrowser({ contacts: scoped }: { contacts: ContactSummary[] }) {
  const router = useRouter();
  const { can } = useRbac();
  const [q, setQ] = React.useState("");
  const [role, setRole] = React.useState<"all" | ContactRole>("all");
  const { sort, onSort } = useSort();

  // Privacy is already applied: the rows come from main_2_owner and main_6_buyer_crm, both
  // RLS-scoped, so an agent's list only ever contains their own owners and leads. The
  // permission is read here purely to caption WHY the list is short.
  const canViewAll = can("contacts.view_all");

  const query = q.trim().toLowerCase();
  // Phone matching ignores punctuation on BOTH sides: the stored numbers are written
  // "066-1532619" but nobody types the dash when they are checking whether a caller is
  // already in the system, which is the one job this page has.
  const queryDigits = normalizePhone(q);
  const filtered = scoped
    .filter((c) => role === "all" || c.roles.includes(role))
    .filter(
      (c) =>
        !query ||
        c.name.toLowerCase().includes(query) ||
        (c.phone ?? "").toLowerCase().includes(query) ||
        (c.line ?? "").toLowerCase().includes(query) ||
        (!!queryDigits && (normalizePhone(c.phone) ?? "").includes(queryDigits))
    );

  const sortFn = SORT_VALUE[sort.key];
  const list = sortFn
    ? [...filtered].sort((a, b) => compareValues(sortFn(a), sortFn(b), sort.dir))
    : filtered;

  const chips: { key: "all" | ContactRole; label: string }[] = [
    { key: "all", label: "ทั้งหมด" },
    ...ROLES.map((r) => ({ key: r, label: ROLE_LABEL[r] })),
  ];

  return (
    <Card>
      {/* Toolbar: search + role chips */}
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
            placeholder="ค้นหาชื่อ / เบอร์ / LINE…"
            className="w-full sm:w-64 pl-8"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap ml-auto items-center">
          {chips.map((c) => {
            const n = c.key === "all" ? scoped.length : scoped.filter((x) => x.roles.includes(c.key as ContactRole)).length;
            return (
              <button
                key={c.key}
                onClick={() => setRole(c.key)}
                className={cn(
                  "text-small font-medium rounded-md px-3 py-1.5 border transition-colors",
                  role === c.key
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

      {!canViewAll && (
        <div className="px-3 py-1.5 text-label text-text-subtle border-b border-border bg-surface-2">
          แสดงเฉพาะเจ้าของทรัพย์ที่คุณดูแล และลูกค้าที่คุณรับผิดชอบ
        </div>
      )}

      {list.length === 0 ? (
        <div className="p-10 text-center text-small text-text-subtle">ไม่พบผู้ติดต่อ</div>
      ) : (
        <>
          {/* Desktop table */}
          <CardContent className="p-0 hidden md:block">
            <Table>
              <THead>
                <TR>
                  <SortHeader label="ชื่อ" sortKey="name" sort={sort} onSort={onSort} />
                  <SortHeader label="บทบาท" sortKey="role" sort={sort} onSort={onSort} />
                  <SortHeader label="เบอร์โทร" sortKey="phone" sort={sort} onSort={onSort} />
                  <SortHeader label="LINE" sortKey="line" sort={sort} onSort={onSort} />
                </TR>
              </THead>
              <TBody>
                {list.map((c) => (
                  <TR
                    key={c.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/contacts/${c.id}`)}
                  >
                    <TD>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={c.name} tone="crimson" />
                        <span className="font-medium">{c.name}</span>
                      </div>
                    </TD>
                    <TD>
                      <div className="flex gap-1 flex-wrap">
                        {c.roles.length ? (
                          c.roles.map((r) => (
                            <Pill key={r} tone={ROLE_TONE[r]}>
                              {ROLE_LABEL[r]}
                            </Pill>
                          ))
                        ) : (
                          <span className="text-text-subtle">—</span>
                        )}
                      </div>
                    </TD>
                    <TD className="num text-small text-text-muted">{c.phone ?? "—"}</TD>
                    <TD className="text-small text-text-muted">{c.line ?? "—"}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>

          {/* Mobile: stacked cards */}
          <ul className="md:hidden divide-y divide-border">
            {list.map((c) => (
              <li
                key={c.id}
                onClick={() => router.push(`/contacts/${c.id}`)}
                className="flex items-center gap-2.5 p-3 cursor-pointer active:bg-surface-hover transition-colors"
              >
                <Avatar name={c.name} tone="crimson" />
                <span className="leading-tight min-w-0 flex-1">
                  <span className="block font-medium truncate">{c.name}</span>
                  <span className="block text-label text-text-subtle num">
                    {c.phone ?? c.line ?? "—"}
                  </span>
                </span>
                <div className="flex flex-wrap justify-end gap-1 shrink-0">
                  {c.roles.map((r) => (
                    <Pill key={r} tone={ROLE_TONE[r]}>
                      {ROLE_LABEL[r]}
                    </Pill>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
