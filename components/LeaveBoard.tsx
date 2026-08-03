"use client";

import * as React from "react";
import { Search, Check, X, CalendarOff, Clock, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import { Avatar } from "@/components/ui/Avatar";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { Stat } from "@/components/ui/Stat";
import { useRbac } from "@/components/RbacProvider";
import { useLeave } from "@/components/LeaveProvider";
import {
  LEAVE_STATUS_LABEL,
  LEAVE_STATUS_TONE,
  leaveDays,
  daysTakenInYear,
  awayOn,
  usageByType,
  overQuota,
  type LeaveStatus,
} from "@/lib/leave";
import { TODAY } from "@/lib/momentum";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";

// วันลา — the HR side. Two audiences on one page:
//   • leave.manage (CEO/HR) → everyone's requests + the approval queue
//   • everyone else         → their own requests only, read-only
// Requests are FILED from แผนวันนี้, not here, so there's no "new request" button.

type Filter = "pending" | LeaveStatus | "all";

export function LeaveBoard() {
  const { can, currentUser } = useRbac();
  const { requests, decide, withdraw, allowances } = useLeave();
  const [q, setQ] = React.useState("");
  const canManage = can("leave.manage");
  // Managers land on the queue (the thing needing action); everyone else on their history.
  const [filter, setFilter] = React.useState<Filter>(canManage ? "pending" : "all");

  // Scope first, filter second — an own-scoped viewer must never see another person's rows.
  const scoped = React.useMemo(
    () => (canManage ? requests : requests.filter((r) => r.employeeId === currentUser.id)),
    [requests, canManage, currentUser.id]
  );

  // Quota is always computed from the FULL request set for this person — not `scoped` —
  // so it's correct regardless of which filter chip is active.
  const myUsage = React.useMemo(
    () => usageByType(requests, allowances, currentUser.id),
    [requests, allowances, currentUser.id]
  );
  const breaches = React.useMemo(
    () => (canManage ? overQuota(requests, allowances) : []),
    [requests, allowances, canManage]
  );

  const query = q.trim().toLowerCase();
  const list = scoped
    .filter((r) => filter === "all" || r.status === filter)
    .filter(
      (r) =>
        !query ||
        r.nickname.toLowerCase().includes(query) ||
        r.type.toLowerCase().includes(query) ||
        (r.remark ?? "").toLowerCase().includes(query)
    )
    .sort((a, b) => b.startDate.localeCompare(a.startDate));

  const count = (f: Filter) =>
    f === "all" ? scoped.length : scoped.filter((r) => r.status === f).length;

  const chips: { key: Filter; label: string }[] = [
    { key: "pending", label: "รออนุมัติ" },
    { key: "approved", label: "อนุมัติแล้ว" },
    { key: "rejected", label: "ไม่อนุมัติ" },
    { key: "all", label: "ทั้งหมด" },
  ];

  const awayToday = awayOn(scoped, TODAY);

  return (
    <div className="flex flex-col gap-4">
      {/* Summary strip */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Stat label="รออนุมัติ" value={String(count("pending"))} />
        <Stat label="ลาวันนี้" value={String(awayToday.length)} />
        <Stat
          label={canManage ? "วันลารวมปีนี้ (อนุมัติแล้ว)" : "วันลาของคุณปีนี้"}
          value={String(
            canManage
              ? scoped
                  .filter((r) => r.status === "approved" && r.startDate.startsWith(TODAY.slice(0, 4)))
                  .reduce((s, r) => s + leaveDays(r), 0)
              : daysTakenInYear(scoped, currentUser.id)
          )}
        />
      </div>

      {/* Your quota. Counts APPROVED leave only — a pending request hasn't been granted, so
          it must not silently eat someone's balance. Untracked types are omitted. */}
      <Card>
        <div className="px-4 py-2.5 border-b border-border flex items-center gap-2 flex-wrap">
          <span className="text-h3">โควตาวันลาของคุณ</span>
          <span className="text-label text-text-subtle">ปี {Number(TODAY.slice(0, 4)) + 543}</span>
          {canManage && (
            <span className="text-label text-text-subtle ml-auto">
              แก้ไขโควตาได้ที่ ตั้งค่า → โควตาวันลา
            </span>
          )}
        </div>
        <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {myUsage
            .filter((u) => u.allowance != null)
            .map((u) => (
              <div key={u.type}>
                <div className="text-label text-text-subtle">{u.type}</div>
                <div className="flex items-baseline gap-1">
                  <span className={cn("num text-h3", u.over && "text-red")}>{u.used}</span>
                  <span className="num text-small text-text-subtle">/ {u.allowance}</span>
                  {u.over && <Pill tone="red">เกิน {Math.abs(u.remaining!)} วัน</Pill>}
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-surface-2 overflow-hidden">
                  <div
                    className={cn("h-full rounded-full", u.over ? "bg-red" : "bg-accent")}
                    style={{ width: `${Math.min(100, (u.used / (u.allowance || 1)) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
        </CardContent>
      </Card>

      {/* HR-only: anyone already past their quota. This is the thing having no balance hid. */}
      {canManage && breaches.length > 0 && (
        <Card>
          <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
            <AlertTriangle size={15} strokeWidth={1.75} className="text-red" />
            <span className="text-h3">เกินโควตา</span>
            <span className="text-label text-text-subtle">{breaches.length} คน</span>
          </div>
          <CardContent className="flex flex-col gap-2">
            {breaches.map((b) => (
              <div key={b.employeeId} className="flex items-center gap-2 flex-wrap">
                <Avatar name={b.nickname} tone="crimson" className="h-6 w-6" />
                <span className="text-body font-medium w-14">{b.nickname}</span>
                {b.rows.map((r) => (
                  <Pill key={r.type} tone="red">
                    {r.type} <span className="num">{r.used}</span>/{r.allowance}
                  </Pill>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Who's away today — the question a manager actually opens this page to answer */}
      {awayToday.length > 0 && (
        <Card>
          <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
            <CalendarOff size={15} strokeWidth={1.75} className="text-accent" />
            <span className="text-h3">ลาวันนี้</span>
            <span className="text-label text-text-subtle">{formatDate(TODAY)}</span>
          </div>
          <CardContent className="flex flex-wrap gap-2">
            {awayToday.map((r) => (
              <span
                key={r.id}
                className="inline-flex items-center gap-2 rounded-full border border-border pl-1 pr-3 py-1"
              >
                <Avatar name={r.nickname} tone="crimson" className="h-6 w-6" />
                <span className="text-small">{r.nickname}</span>
                <span className="text-label text-text-subtle">{r.type}</span>
                {r.status === "pending" && <Pill tone="amber">รออนุมัติ</Pill>}
              </span>
            ))}
          </CardContent>
        </Card>
      )}

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
              placeholder="ค้นหาชื่อ / ประเภท / เหตุผล…"
              className="w-full sm:w-64 pl-8"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap ml-auto">
            {chips.map((c) => (
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
                {c.label} <span className="num">({count(c.key)})</span>
              </button>
            ))}
          </div>
        </div>

        {list.length === 0 ? (
          <div className="p-10 text-center text-small text-text-subtle">
            {filter === "pending" ? "ไม่มีใบลารออนุมัติ" : "ไม่พบใบลา"}
          </div>
        ) : (
          <CardContent className="p-0">
            <Table className="min-w-[820px]">
              <THead>
                <TR>
                  {canManage && <TH>พนักงาน</TH>}
                  <TH>ช่วงวันที่</TH>
                  <TH className="text-right">จำนวนวัน</TH>
                  <TH>ประเภท</TH>
                  <TH>เหตุผล</TH>
                  <TH>ยื่นเมื่อ</TH>
                  <TH>สถานะ</TH>
                  <TH className="text-right">จัดการ</TH>
                </TR>
              </THead>
              <TBody>
                {list.map((r) => {
                  const mine = r.employeeId === currentUser.id;
                  return (
                    <TR key={r.id}>
                      {canManage && (
                        <TD>
                          <span className="inline-flex items-center gap-2">
                            <Avatar name={r.nickname} tone="crimson" className="h-6 w-6" />
                            <span className="font-medium">{r.nickname}</span>
                          </span>
                        </TD>
                      )}
                      <TD className="num text-small whitespace-nowrap">
                        {formatDate(r.startDate)}
                        {r.endDate !== r.startDate && ` – ${formatDate(r.endDate)}`}
                      </TD>
                      <TD className="num text-right">{leaveDays(r)}</TD>
                      <TD className="text-small whitespace-nowrap">{r.type}</TD>
                      <TD className="text-small text-text-muted max-w-[220px]">
                        <span className="line-clamp-1">{r.remark ?? "—"}</span>
                      </TD>
                      <TD className="num text-small text-text-subtle whitespace-nowrap">
                        {formatDate(r.submittedAt)}
                      </TD>
                      <TD>
                        <Pill tone={LEAVE_STATUS_TONE[r.status]}>{LEAVE_STATUS_LABEL[r.status]}</Pill>
                        {r.decidedBy && (
                          <div className="text-label text-text-subtle mt-0.5 num">โดย {r.decidedBy}</div>
                        )}
                      </TD>
                      <TD className="text-right whitespace-nowrap">
                        {r.status === "pending" && canManage && (
                          <span className="inline-flex gap-1.5">
                            <button
                              onClick={() => decide(r.id, "approved", currentUser.name, TODAY)}
                              className="h-7 px-2.5 rounded-md border border-green/30 bg-green-bg text-green text-small font-medium inline-flex items-center gap-1 hover:opacity-80 transition-opacity"
                            >
                              <Check size={13} strokeWidth={2.5} /> อนุมัติ
                            </button>
                            <button
                              onClick={() => decide(r.id, "rejected", currentUser.name, TODAY)}
                              className="h-7 px-2.5 rounded-md border border-border-strong text-text-muted text-small font-medium inline-flex items-center gap-1 hover:bg-red-bg hover:text-red hover:border-red/30 transition-colors"
                            >
                              <X size={13} strokeWidth={2.5} /> ไม่อนุมัติ
                            </button>
                          </span>
                        )}
                        {/* You can pull back your own request while it's still undecided. */}
                        {r.status === "pending" && mine && !canManage && (
                          <button
                            onClick={() => withdraw(r.id)}
                            className="h-7 px-2.5 rounded-md border border-border-strong text-text-muted text-small hover:bg-surface-2 transition-colors"
                          >
                            ยกเลิก
                          </button>
                        )}
                        {r.status === "pending" && !canManage && !mine && (
                          <span className="text-label text-text-subtle inline-flex items-center gap-1">
                            <Clock size={11} strokeWidth={1.75} /> รอ HR
                          </span>
                        )}
                        {r.status !== "pending" && <span className="text-text-subtle">—</span>}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </CardContent>
        )}
      </Card>

      {!canManage && (
        <p className="text-label text-text-subtle">
          ยื่นใบลาได้ที่หน้า <span className="text-text-muted">แผนวันนี้</span> — ปุ่ม “ขอลา”
        </p>
      )}
    </div>
  );
}
