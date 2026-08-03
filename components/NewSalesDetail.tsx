"use client";

import * as React from "react";
import { Medal, Trophy, Check, CalendarDays, History } from "lucide-react";
import { useProbation } from "@/components/ProbationProvider";
import { rankedNewSales, daysBetween } from "@/components/NewSalesBoard";
import { currentRankName, WINDOW_LABEL } from "@/lib/probation";
import { useActivities } from "@/components/ActivityProvider";
import { TODAY } from "@/lib/momentum";
import { formatDate } from "@/lib/format";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Avatar } from "@/components/ui/Avatar";
import { RingProgress } from "@/components/ui/RingProgress";
import { cn } from "@/lib/cn";

// One new sale's full probation stats — the click-through from the เซลล์ใหม่ leaderboard.
// Shows the whole ladder (achieved + upcoming ranks with per-criterion bars) and the
// agent's recent logged activities. Same live derivation as the board (ProbationProvider).
export function NewSalesDetail({ employeeId }: { employeeId: string }) {
  const { ranks } = useProbation();
  // LIVE log — the ladder and the activity list below must both reflect work logged from
  // the Daily Plan, not the frozen sample.
  const { activities } = useActivities();
  const rows = rankedNewSales(ranks, activities);
  const idx = rows.findIndex((r) => r.employee.id === employeeId);

  if (idx === -1) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-small text-text-subtle">
          ไม่พบเซลล์ใหม่คนนี้ในโปรแกรมโปรเบชั่น
        </CardContent>
      </Card>
    );
  }

  const { employee: e, ev } = rows[idx];
  const days = daysBetween(e.probationStart, TODAY);
  const acts = activities
    .filter((a) => a.created_by === e.nickname)
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-4">
      {/* Identity header */}
      <Card>
        <CardContent className="flex items-center gap-3 flex-wrap">
          <span
            className={cn(
              "size-8 rounded-full grid place-items-center num text-body font-semibold shrink-0",
              idx === 0 ? "bg-amber-bg text-amber" : "bg-surface-2 text-text-muted"
            )}
          >
            {idx + 1}
          </span>
          <Avatar name={e.nickname} tone="crimson" src={e.avatarUrl} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-h2">{e.nickname}</span>
              <span className="num text-label text-text-subtle">{e.code}</span>
              {ev.passed ? (
                <Pill tone="green">
                  <Trophy size={11} strokeWidth={1.75} /> ผ่านโปรเบชั่น
                </Pill>
              ) : (
                <Pill tone={ev.currentIndex >= 0 ? "accent" : "neutral"}>
                  <Medal size={11} strokeWidth={1.75} /> {currentRankName(ev)}
                </Pill>
              )}
            </div>
            <div className="text-small text-text-muted inline-flex items-center gap-1 mt-0.5">
              <CalendarDays size={12} strokeWidth={1.75} />
              เริ่มโปรแกรม {formatDate(e.probationStart)} · <span className="num">{days}</span> วัน
            </div>
          </div>
          <div className="text-right">
            <RingProgress pct={Math.round((ev.next ? ev.next.pct : 1) * 100)} size={52} stroke={5} />
            <div className="text-label text-text-subtle mt-1">
              {ev.next ? `สู่ ${ev.next.rank.name}` : "ครบทุกเกณฑ์"}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 items-start">
        {/* The full ladder — every rank with its criteria */}
        <div className="flex flex-col gap-4">
          {ev.ranks.map((r, ri) => {
            const achieved = ri <= ev.currentIndex;
            const isNext = ev.next?.rank.id === r.rank.id;
            return (
              <Card key={r.rank.id} className={cn(!achieved && !isNext && "opacity-70")}>
                <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
                  <span
                    className={cn(
                      "size-7 rounded-full grid place-items-center num text-small font-semibold shrink-0",
                      achieved ? "bg-green-bg text-green" : isNext ? "bg-accent-wash text-accent" : "bg-surface-2 text-text-subtle"
                    )}
                  >
                    {ri + 1}
                  </span>
                  <span className="text-h3">{r.rank.name}</span>
                  {achieved ? (
                    <Pill tone="green">
                      <Check size={11} strokeWidth={2.5} /> ผ่านแล้ว
                    </Pill>
                  ) : isNext ? (
                    <Pill tone="accent">กำลังไต่</Pill>
                  ) : (
                    <Pill tone="neutral">ถัดไป</Pill>
                  )}
                  <span className="num text-small text-text-subtle ml-auto">
                    {Math.round(r.pct * 100)}%
                  </span>
                </div>
                <CardContent className="flex flex-col gap-2.5">
                  {r.criteria.length === 0 && (
                    <p className="text-small text-text-subtle">Rank นี้ไม่มีเกณฑ์ — ผ่านทันที</p>
                  )}
                  {r.criteria.map((c) => (
                    <div key={c.id} className="flex items-center gap-2.5">
                      <div className="w-36 shrink-0 text-small truncate">
                        {c.activityType}
                        <span className="text-label text-text-subtle ml-1">{WINDOW_LABEL[c.window]}</span>
                      </div>
                      <div className="flex-1 h-2 rounded-full bg-surface-2 overflow-hidden">
                        <div
                          className={cn("h-full rounded-full", c.met ? "bg-green" : "bg-accent")}
                          style={{ width: `${Math.min(100, (c.have / c.target) * 100)}%` }}
                        />
                      </div>
                      <div className="num text-small w-16 text-right shrink-0">
                        <span className={c.met ? "text-green font-medium" : "text-text"}>{c.have}</span>
                        <span className="text-text-subtle"> / {c.target}</span>
                      </div>
                      {c.met && <Check size={14} strokeWidth={2.5} className="text-green shrink-0" />}
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Recent logged activities — the raw effort behind the tallies */}
        <Card>
          <CardHeader>
            <CardTitle>กิจกรรมที่บันทึก</CardTitle>
            <span className="num text-small text-text-subtle">{acts.length} รายการ</span>
          </CardHeader>
          {acts.length ? (
            <div className="divide-y divide-border">
              {acts.map((a) => (
                <div key={a.id} className="flex items-start gap-3 px-4 py-2.5">
                  <span className="mt-1.5 size-2 rounded-full bg-accent shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-body font-medium">{a.action}</span>
                      {a.count > 1 && <span className="num text-label text-text-subtle">×{a.count}</span>}
                    </div>
                    {a.remark && <p className="text-small text-text-muted mt-0.5 line-clamp-1">{a.remark}</p>}
                  </div>
                  <span className="num text-label text-text-subtle whitespace-nowrap shrink-0">
                    {formatDate(a.date)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
              <History size={20} strokeWidth={1.5} className="text-text-subtle" />
              <p className="text-small text-text-subtle">ยังไม่มีกิจกรรมที่บันทึก</p>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
