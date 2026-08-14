"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Pencil, Plus, Crown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Avatar } from "@/components/ui/Avatar";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { useRbac } from "@/components/RbacProvider";
import { employeeFullName, DEPARTMENT_LABEL, type Employee } from "@/lib/team";

// ทีม / บุคคล — the roster, from main_1_hr (Phase 6; it was a seeded array with invented
// salaries for real colleagues).
//
// No client-side team scoping any more. The old version filtered rows through the seeded
// org store, comparing seed user ids that a real session never carries — so it either
// showed everything or nothing by accident. main_1_hr's SELECT policy is `using (true)` by
// design (the roster is public; pay and PII are cut at the GRANT level), so every signed-in
// person legitimately sees every row.

export function TeamTable({ employees }: { employees: Employee[] }) {
  const router = useRouter();
  const { can } = useRbac();
  const [q, setQ] = React.useState("");

  const showMoney = can("financials.view_comp");
  const canManage = can("people.manage");
  // `user_roles` SELECT is own-row unless you hold roles.manage/people.manage, so an agent
  // reads back nothing for their colleagues. Rendering that as "—" would say "no role
  // assigned" when the truth is "not visible to you" — drop the column instead.
  const showRoles = can("roles.manage") || can("people.manage");

  const query = q.trim().toLowerCase();
  const list = employees.filter(
    (e) =>
      !query ||
      e.nickname.toLowerCase().includes(query) ||
      employeeFullName(e).toLowerCase().includes(query) ||
      e.code.toLowerCase().includes(query)
  );

  return (
    <Card>
      <div className="flex items-center gap-2.5 p-3 border-b border-border">
        <div className="relative w-full sm:w-auto">
          <Search
            size={14}
            strokeWidth={1.75}
            className="text-text-subtle absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหาชื่อ / ชื่อเล่น / รหัส…"
            className="w-full sm:w-64 pl-8"
          />
        </div>
        <span className="text-small text-text-subtle ml-auto num">{list.length} คน</span>
        {canManage && (
          <Button size="sm" onClick={() => router.push("/team/new")}>
            <Plus size={15} strokeWidth={2} /> เพิ่มพนักงาน
          </Button>
        )}
      </div>

      <CardContent className="p-0">
        <Table className="min-w-[900px]">
          <THead>
            <TR>
              <TH>พนักงาน</TH>
              {showRoles && <TH>บทบาท</TH>}
              <TH>ตำแหน่ง</TH>
              <TH>ทีม</TH>
              <TH>โซน</TH>
              <TH>สถานะ</TH>
              <TH className="text-right">กิจกรรมเดือนนี้</TH>
              {showMoney && <TH className="text-right">คอมมิชชั่น</TH>}
              {canManage && <TH className="text-right">จัดการ</TH>}
            </TR>
          </THead>
          <TBody>
            {list.map((e) => (
              <TR
                key={e.code}
                className="cursor-pointer hover:bg-surface-hover transition-colors"
                onClick={() => router.push(`/team/${e.code}`)}
              >
                <TD>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={e.nickname} tone="crimson" />
                    <div className="min-w-0">
                      <div className="font-medium">{e.nickname}</div>
                      <div className="text-label text-text-subtle truncate">
                        {employeeFullName(e)}
                        {e.code ? ` · ${e.code}` : ""}
                      </div>
                    </div>
                  </div>
                </TD>
                {showRoles && (
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      {e.roleNames.length ? (
                        e.roleNames.map((n) => (
                          <Pill key={n} tone="neutral">
                            {n}
                          </Pill>
                        ))
                      ) : (
                        <span className="text-text-subtle">—</span>
                      )}
                    </div>
                  </TD>
                )}
                <TD className="text-small">
                  <div className="text-text">{e.position || "—"}</div>
                  <div className="text-label text-text-subtle">{DEPARTMENT_LABEL[e.department]}</div>
                </TD>
                <TD className="text-small">
                  {e.teamName ? (
                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                      {e.isTeamLeader && (
                        <Crown size={12} strokeWidth={2} className="text-amber shrink-0" />
                      )}
                      <span className={e.isTeamLeader ? "text-text font-medium" : "text-text-muted"}>
                        {e.teamName}
                      </span>
                    </span>
                  ) : (
                    <span className="text-text-subtle">—</span>
                  )}
                </TD>
                <TD className="text-small text-text-muted max-w-[220px]">
                  <span className="line-clamp-1">
                    {e.zoneNames.length ? e.zoneNames.join(", ") : "—"}
                  </span>
                </TD>
                <TD>
                  {e.status === "active" ? (
                    <Pill tone="green">ทำงานอยู่</Pill>
                  ) : (
                    <Pill tone="neutral">พ้นสภาพ</Pill>
                  )}
                </TD>
                {/* null ≠ 0 — you are not allowed to see this person's activity log, which
                    is a different statement from "they logged nothing". */}
                <TD className="num text-right text-text-muted">
                  {e.effortThisMonth ?? <span className="text-text-subtle">—</span>}
                </TD>
                {showMoney && (
                  <TD className="num text-right font-medium">
                    {e.commissionRate != null ? `${(e.commissionRate * 100).toFixed(1)}%` : "—"}
                  </TD>
                )}
                {canManage && (
                  <TD className="text-right">
                    <Link
                      href={`/team/${e.code}?edit=1`}
                      onClick={(ev) => ev.stopPropagation()}
                      aria-label={`แก้ไข ${e.nickname}`}
                      className="inline-grid place-items-center size-7 rounded-md text-text-muted hover:bg-surface-2 hover:text-text transition-colors"
                    >
                      <Pencil size={14} strokeWidth={1.75} />
                    </Link>
                  </TD>
                )}
              </TR>
            ))}
          </TBody>
        </Table>
      </CardContent>
    </Card>
  );
}
