"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { SegmentedItem, SegmentedTrack } from "@/components/ui/Segmented";
import { cn } from "@/lib/cn";
import { ALL_CATEGORIES, type ActivityHeatmap as HeatmapData, type HeatmapMember } from "@/lib/activityHeatmap";

/* กิจกรรมรายวัน × คน — who logged work, on which day, for one month.
 *
 * The HAUS V2 overview's heatmap, rebuilt on this app's data and tokens: days run DOWN
 * the side, people run ACROSS the top under their avatar and month total, and every cell
 * prints its count. Ben chose that layout over the compact one, 2026-09-16.
 *
 * ── THE FILL IS MIXED INTO THE SURFACE, NOT LAID OVER IT ────────────────────────
 * `.cell-wash` (app/globals.css) — the same mechanism the sheet tables use. The hue is
 * mixed into `--surface` at a percentage, so the scale re-resolves per theme for free and
 * there is no hex anywhere in this file. HAUS V2 computed an hsl() ramp and flipped its
 * ink to white past 60% intensity; here the ink stays `--text` and the fill tops out
 * where that is still legible, which is what makes the same card work in dark mode.
 *
 * ── CLIENT-SIDE FILTERING, ON PURPOSE ───────────────────────────────────────────
 * Every category arrives together: a month for a six-person team is a few hundred
 * numbers, and a round-trip per pill would cost more than the whole card. The range bar
 * lives in the URL because a server render depends on it; this pill does not.
 *
 * ── THE PILLS ARE DATA ──────────────────────────────────────────────────────────
 * They come from `action_category` via lib/teamDashboard. This file names no category —
 * rename one in ตั้งค่า and the pill follows, add one and it appears.
 */
export function ActivityHeatmap({ data }: { data: HeatmapData }) {
  const [cat, setCat] = useState<string>(ALL_CATEGORIES);
  const { members, daysInMonth, today, monthLabel, categories } = data;
  const peak = data.peak[cat] ?? 0;
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // People are ordered by the CURRENT pill, not by the month's grand total: filtered to
  // สำรวจ, the person who did the most surveying belongs first. Ties keep the server's
  // Thai-collated name order.
  const ordered = [...members].sort(
    (a, b) => (b.totals[cat] ?? 0) - (a.totals[cat] ?? 0) || members.indexOf(a) - members.indexOf(b)
  );
  const leaderCode = (ordered[0]?.totals[cat] ?? 0) > 0 ? ordered[0].code : null;

  const silent = (data.peak[ALL_CATEGORIES] ?? 0) === 0;

  return (
    <Card>
      <CardHeader className="h-auto flex-wrap gap-2 py-3">
        <CardTitle>กิจกรรมรายวัน · {monthLabel}</CardTitle>
        <SegmentedTrack aria-label="หมวดกิจกรรม" className="flex-wrap">
          {categories.map((c) => (
            <SegmentedItem key={c.key} size="sm" on={cat === c.key} onClick={() => setCat(c.key)}>
              {c.label}
            </SegmentedItem>
          ))}
        </SegmentedTrack>
      </CardHeader>

      <CardContent>
        {members.length === 0 ? (
          <Empty>ยังไม่มีสมาชิกในทีม — ใส่คนเข้าทีมได้ที่ ตั้งค่า ▸ ทีม</Empty>
        ) : silent ? (
          <Empty>ยังไม่มีกิจกรรมที่บันทึกไว้ใน{monthLabel}</Empty>
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: 36 + ordered.length * 76 }}>
              {/* Column heads: avatar, name, month total — the leaderboard HAUS V2 put on
                  top of the grid, so the card answers "who" before "when". */}
              <Row people={ordered.length}>
                <div />
                {ordered.map((m) => (
                  <ColumnHead key={m.code} member={m} total={m.totals[cat] ?? 0} isLeader={m.code === leaderCode} />
                ))}
              </Row>

              <div className="mt-2 space-y-1">
                {days.map((d) => {
                  const isToday = d === today;
                  return (
                    <Row key={d} people={ordered.length}>
                      <div
                        className={cn(
                          "num self-center pr-1.5 text-right text-[10px] leading-none",
                          isToday ? "font-semibold text-accent-ink" : "text-text-subtle"
                        )}
                      >
                        {d}
                      </div>
                      {ordered.map((m) => (
                        <Cell
                          key={m.code}
                          value={m.days[d - 1]?.[cat] ?? 0}
                          peak={peak}
                          isToday={isToday}
                          title={`${d} ${monthLabel} · ${m.nickname} · ${m.days[d - 1]?.[cat] ?? 0} ครั้ง`}
                        />
                      ))}
                    </Row>
                  );
                })}
              </div>

              <div className="mt-3 flex items-center gap-1.5 text-label text-text-subtle">
                <span>น้อย</span>
                {[0, 0.25, 0.5, 0.75, 1].map((p) => (
                  <span key={p} className="cell-wash size-3.5 rounded-[3px]" style={mix(p)} />
                ))}
                <span>มาก</span>
                {peak > 0 && <span className="num ml-auto">สูงสุด {peak} ครั้ง/วัน</span>}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* One grid line: the day-number gutter, then a column per person. The people columns
   share whatever is left, so six members fill the card exactly as three do. */
function Row({ people, children }: { people: number; children: React.ReactNode }) {
  return (
    <div
      className="grid gap-1"
      style={{ gridTemplateColumns: `28px repeat(${people}, minmax(0, 1fr))` }}
    >
      {children}
    </div>
  );
}

function ColumnHead({ member, total, isLeader }: { member: HeatmapMember; total: number; isLeader: boolean }) {
  return (
    <Link
      href={`/team/${encodeURIComponent(member.code)}`}
      className="flex min-w-0 flex-col items-center gap-1 pb-1 text-text transition-colors hover:text-accent-ink"
    >
      <Avatar
        name={member.nickname}
        src={member.avatarUrl}
        tone="neutral"
        className={cn("size-7 text-[10px]", isLeader && "ring-2 ring-dot-amber ring-offset-1 ring-offset-surface")}
      />
      <span className="max-w-full truncate text-label font-medium">{member.nickname}</span>
      <span className={cn("num text-label", isLeader ? "font-semibold text-text" : "text-text-subtle")}>
        {total || "—"}
      </span>
    </Link>
  );
}

/* The fill percentage for an intensity of 0–1. A cell with work in it starts at 14% so
   one activity is still visibly different from none — a linear scale from zero makes the
   quiet days indistinguishable from the idle ones, which is the distinction the card
   exists to draw. It stops at 86%: past that the count printed on top stops being
   readable, and the number is the point of this layout. */
function mix(intensity: number): React.CSSProperties {
  return {
    "--wash-hue": "var(--dot-green)",
    "--wash-mix": `${Math.round(14 + 72 * intensity)}%`,
  } as React.CSSProperties;
}

function Cell({ value, peak, isToday, title }: { value: number; peak: number; isToday: boolean; title: string }) {
  const empty = value <= 0;
  return (
    <div
      title={title}
      className={cn(
        "num grid h-6 place-items-center rounded-[3px] text-[11px] text-text",
        empty ? "bg-surface-3" : "cell-wash",
        isToday && "outline outline-1 outline-accent/45"
      )}
      style={empty ? undefined : mix(peak > 0 ? value / peak : 0)}
    >
      {empty ? "" : value}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-small text-text-subtle">{children}</p>;
}
