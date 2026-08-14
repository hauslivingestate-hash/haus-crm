"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Medal, Sprout, Trophy, ChevronRight, CalendarDays } from "lucide-react";
import { useProbation } from "@/components/ProbationProvider";
import {
  evaluateLadder,
  currentRankName,
  ladderScore,
  type LadderEvaluation,
  type SalesRank,
} from "@/lib/probation";
import type { Employee } from "@/lib/team";
import type { ActivityTally } from "@/lib/probation";
import { todayISO } from "@/lib/momentum";
import { Card, CardContent } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { Pill } from "@/components/ui/Pill";
import { Avatar } from "@/components/ui/Avatar";
import { RingProgress } from "@/components/ui/RingProgress";
import { cn } from "@/lib/cn";

// เซลล์ใหม่ (probation) leaderboard — ranking first; click a row for the agent's full
// stats (/new-sales/[code]). Rank is DERIVED from the real activity log against the CEO's
// ladder — auto-promote, nothing stored.
//
// Population = active sales who are IN the programme: `probation_start` set and
// `probation_passed_at` still null. Ben, 2026-08-14: the programme starts from zero and
// everyone currently employed is marked as having passed, so this is empty today and fills
// as new people are enrolled on their employee record.

interface Row {
  employee: Employee;
  ev: LadderEvaluation;
}

/** Shared by the board + detail page so both rank identically.
 *  `activities` = the LIVE log (ActivityProvider), so completing a Daily-Plan task
 *  re-ranks immediately — auto-promote depends on reading the same log the plan writes. */
export function rankedNewSales(
  ranks: SalesRank[],
  employees: Employee[] = [],
  tallies: Record<string, ActivityTally> = {}
): Row[] {
  return employees
    .filter(
      (e) =>
        e.status === "active" &&
        e.department === "sales" &&
        !!e.probationStart &&
        !e.probationPassedAt
    )
    .map((employee) => ({
      employee,
      ev: evaluateLadder(ranks, tallies[employee.code]),
    }))
    .sort((a, b) => ladderScore(b.ev) - ladderScore(a.ev));
}

export function NewSalesBoard({
  employees = [],
  tallies = {},
}: {
  employees?: Employee[];
  tallies?: Record<string, ActivityTally>;
}) {
  const { ranks } = useProbation();
  const router = useRouter();
  const rows = rankedNewSales(ranks, employees, tallies);

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-2 py-14 text-center">
          <Sprout size={22} strokeWidth={1.5} className="text-text-subtle" />
          <p className="text-small text-text-subtle">ยังไม่มีเซลล์ใหม่ในโปรแกรมโปรเบชั่น</p>
          <p className="text-label text-text-subtle max-w-sm">
            พนักงานปัจจุบันผ่านโปรเบชั่นครบทุกคนแล้ว — เริ่มนับใหม่จาก 0
            <br />
            เซลใหม่ที่เข้ามาให้กดปุ่ม “เข้าโปรแกรมเซลล์ใหม่” ในหน้าประวัติพนักงาน
            แล้วชื่อจะขึ้นที่กระดานนี้เอง
          </p>
        </CardContent>
      </Card>
    );
  }

  const passed = rows.filter((r) => r.ev.passed).length;

  return (
    <div className="space-y-4">
      {/* Overview stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="เซลล์ใหม่" value={rows.length} hint="อยู่ในโปรแกรมโปรเบชั่น" />
        <Stat label="ผ่านโปรเบชั่น" value={passed} hint="ครบทุก Rank แล้ว" />
        <Stat label="จำนวน Rank" value={ranks.length} hint="ตั้งค่าที่ ตั้งค่า → Rank เซลล์ใหม่" />
        <Stat
          label="เกณฑ์ทั้งหมด"
          value={ranks.reduce((s, r) => s + r.criteria.length, 0)}
          hint="นับจากกิจกรรมจริง"
        />
      </div>

      {/* Leaderboard — ranking only; click a row for full stats */}
      <Card>
        <div className="px-4 h-11 flex items-center gap-2 border-b border-border">
          <Trophy size={15} strokeWidth={1.75} className="text-amber" />
          <span className="text-h3">อันดับเซลล์ใหม่</span>
          <span className="text-label text-text-subtle ml-auto">แตะชื่อเพื่อดูสถิติ</span>
        </div>
        <ul className="divide-y divide-border">
          {rows.map((row, i) => {
            const { employee: e, ev } = row;
            const days = daysBetween(e.probationStart, todayISO());
            return (
              <li key={e.code}>
                <button
                  onClick={() => router.push(`/new-sales/${e.code}`)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-hover transition-colors"
                >
                  <span
                    className={cn(
                      "size-7 rounded-full grid place-items-center num text-small font-semibold shrink-0",
                      i === 0 ? "bg-amber-bg text-amber" : "bg-surface-2 text-text-muted"
                    )}
                  >
                    {i + 1}
                  </span>
                  <Avatar name={e.nickname} tone="crimson" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-body font-semibold">{e.nickname}</span>
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
                    <div className="text-label text-text-subtle inline-flex items-center gap-1 mt-0.5">
                      <CalendarDays size={11} strokeWidth={1.75} />
                      <span className="num">{days}</span> วันในโปรแกรม
                      {ev.next && (
                        <span className="ml-1">
                          · กำลังไต่สู่ <span className="text-text-muted">{ev.next.rank.name}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Ladder chips — achieved at a glance (wide screens) */}
                  <div className="hidden md:flex items-center gap-1">
                    {ev.ranks.map((r, ri) => (
                      <span
                        key={r.rank.id}
                        title={r.rank.name}
                        className={cn(
                          "h-6 px-2 rounded-md grid place-items-center text-label font-medium border",
                          ri <= ev.currentIndex
                            ? "bg-accent-wash text-accent border-accent"
                            : "border-border text-text-subtle"
                        )}
                      >
                        {r.rank.name}
                      </span>
                    ))}
                  </div>
                  <RingProgress pct={Math.round((ev.next ? ev.next.pct : 1) * 100)} size={40} stroke={4} />
                  <ChevronRight size={16} strokeWidth={1.75} className="text-text-subtle shrink-0" />
                </button>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

// Whole days from `from` (YYYY-MM-DD) to `to`, floored at 0.
export function daysBetween(from: string | undefined, to: string): number {
  if (!from) return 0;
  const a = new Date(`${from}T00:00:00Z`).getTime();
  const b = new Date(`${to}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}
