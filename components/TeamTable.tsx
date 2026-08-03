"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Pencil, Plus, Crown, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Avatar } from "@/components/ui/Avatar";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { useRbac } from "@/components/RbacProvider";
import { useActivities } from "@/components/ActivityProvider";
import {
  listEmployees,
  effortThisMonth,
  employeeFullName,
  employeeZoneNames,
  DEPARTMENT_LABEL,
} from "@/lib/team";
import { teamOf, visibleMemberIds } from "@/lib/teams";

export function TeamTable() {
  const router = useRouter();
  const { roles, users, teams, currentUser, can } = useRbac();
  // LIVE log — the effort column is one of the surfaces people review activity on, so it
  // must move when a Daily-Plan task is ticked (same as Targets / เซลล์ใหม่).
  const { activities } = useActivities();
  const [q, setQ] = React.useState("");

  const showMoney = can("financials.view_comp");
  const canManage = can("people.manage");

  // Team scoping: org-wide viewers (CEO/HR) see everyone; a team leader who isn't org-wide
  // sees only their own team. null = no scope (see all).
  const isOrgWide = can("roles.manage") || can("people.manage");
  const scopeIds = visibleMemberIds(teams, currentUser.id, isOrgWide);
  const scopedTeam = scopeIds ? teams.find((t) => t.leaderId === currentUser.id) : undefined;

  const roleNames = (uid: string) => {
    const u = users.find((x) => x.id === uid);
    if (!u || u.roleIds.length === 0) return [] as string[];
    return u.roleIds.map((rid) => roles.find((r) => r.id === rid)?.name ?? rid);
  };

  const query = q.trim().toLowerCase();
  const list = listEmployees()
    .filter((e) => !scopeIds || scopeIds.has(e.id))
    .filter(
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

      {scopedTeam && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-surface-2/60 text-small text-text-muted">
          <Users size={14} strokeWidth={1.75} className="text-accent" />
          แสดงเฉพาะ<span className="font-medium text-text">{scopedTeam.name}</span>ที่คุณเป็นหัวหน้า
        </div>
      )}

      <CardContent className="p-0">
        <Table className="min-w-[900px]">
          <THead>
            <TR>
              <TH>พนักงาน</TH>
              <TH>บทบาท</TH>
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
            {list.map((e) => {
              const rnames = roleNames(e.id);
              const zoneNames = employeeZoneNames(e);
              return (
                <TR
                  key={e.id}
                  className="cursor-pointer hover:bg-surface-hover transition-colors"
                  onClick={() => router.push(`/team/${e.id}`)}
                >
                  <TD>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={e.nickname} tone="crimson" src={e.avatarUrl} />
                      <div className="min-w-0">
                        <div className="font-medium flex items-center gap-1.5">
                          {e.nickname}
                          {/* Probation tag — rank derives live on the เซลล์ใหม่ board */}
                          {e.probationStart && <Pill tone="green">เซลล์ใหม่</Pill>}
                        </div>
                        <div className="text-label text-text-subtle truncate">
                          {employeeFullName(e)}
                          {e.code ? ` · ${e.code}` : ""}
                        </div>
                      </div>
                    </div>
                  </TD>
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      {rnames.length ? (
                        rnames.map((n) => (
                          <Pill key={n} tone="neutral">
                            {n}
                          </Pill>
                        ))
                      ) : (
                        <span className="text-text-subtle">—</span>
                      )}
                    </div>
                  </TD>
                  <TD className="text-small">
                    <div className="text-text">{e.position || "—"}</div>
                    <div className="text-label text-text-subtle">{DEPARTMENT_LABEL[e.department]}</div>
                  </TD>
                  <TD className="text-small">
                    {(() => {
                      const t = teamOf(teams, e.id);
                      if (!t) return <span className="text-text-subtle">—</span>;
                      const isLeader = t.leaderId === e.id;
                      return (
                        <span className="inline-flex items-center gap-1 whitespace-nowrap">
                          {isLeader && <Crown size={12} strokeWidth={2} className="text-amber shrink-0" />}
                          <span className={isLeader ? "text-text font-medium" : "text-text-muted"}>{t.name}</span>
                        </span>
                      );
                    })()}
                  </TD>
                  <TD className="text-small text-text-muted">
                    {zoneNames.length ? zoneNames.join(", ") : "—"}
                  </TD>
                  <TD>
                    {e.status === "active" ? (
                      <Pill tone="green">ทำงานอยู่</Pill>
                    ) : (
                      <Pill tone="neutral">พ้นสภาพ</Pill>
                    )}
                  </TD>
                  <TD className="num text-right text-text-muted">
                    {effortThisMonth(e.nickname, undefined, activities)}
                  </TD>
                  {showMoney && (
                    <TD className="num text-right font-medium">
                      {e.commissionRate != null ? `${(e.commissionRate * 100).toFixed(1)}%` : "—"}
                    </TD>
                  )}
                  {canManage && (
                    <TD className="text-right">
                      <Link
                        href={`/team/${e.id}?edit=1`}
                        onClick={(ev) => ev.stopPropagation()}
                        aria-label={`แก้ไข ${e.nickname}`}
                        className="inline-grid place-items-center size-7 rounded-md text-text-muted hover:bg-surface-2 hover:text-text transition-colors"
                      >
                        <Pencil size={14} strokeWidth={1.75} />
                      </Link>
                    </TD>
                  )}
                </TR>
              );
            })}
          </TBody>
        </Table>
      </CardContent>
    </Card>
  );
}
