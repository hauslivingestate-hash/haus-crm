"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { TH_MONTHS } from "@/lib/format";
import { type Task } from "@/lib/momentum";
import { cn } from "@/lib/cn";

// Compact month picker for the Daily Plan date popover — adapted from Solo Gang's MiniCalendar.
// Browses months with ◀ ▶ (view only); clicking a day fires onPick. Each day shows a status dot
// from that day's tasks (all done → accent · some open → amber · no tasks → none), so you can
// scan where work is planned. Today gets an accent ring; the selected day gets an accent fill.

const DOW = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"]; // Monday-first (matches Thai week convention)

const ymOf = (iso: string) => iso.slice(0, 7);

function addMonth(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  // Christian era, matching formatDate. A month heading keeps the Thai month NAME
  // ("ส.ค. 2026") — "08/2026" would read as a truncated date, not a heading.
  return `${TH_MONTHS[m - 1]} ${y}`;
}

type DayStatus = "full" | "partial" | "none";
function statusFor(tasks: Task[], date: string): DayStatus {
  const day = tasks.filter((t) => t.date === date);
  if (day.length === 0) return "none";
  return day.every((t) => t.done) ? "full" : "partial";
}

export function MiniCalendar({
  selected,
  today,
  tasks,
  onPick,
}: {
  selected: string;
  /** Passed in rather than read from a constant — the plan runs on the real clock now. */
  today: string;
  tasks: Task[];
  onPick: (date: string) => void;
}) {
  // Seed the browsed month from the selected day, so you open onto the month you're planning.
  const [month, setMonth] = React.useState(() => ymOf(selected));
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate(); // day 0 of next month = last day of this one
  const lead = (new Date(`${month}-01T00:00:00`).getDay() + 6) % 7; // blanks before day 1 (Mon-first)

  return (
    <div>
      {/* Month nav */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <button
          onClick={() => setMonth((mo) => addMonth(mo, -1))}
          aria-label="เดือนก่อนหน้า"
          className="size-7 grid place-items-center rounded-md border border-border text-text-muted hover:bg-surface-hover transition-colors"
        >
          <ChevronLeft size={15} strokeWidth={1.75} />
        </button>
        <div className="text-body font-semibold num">{monthLabel(month)}</div>
        <button
          onClick={() => setMonth((mo) => addMonth(mo, 1))}
          aria-label="เดือนถัดไป"
          className="size-7 grid place-items-center rounded-md border border-border text-text-muted hover:bg-surface-hover transition-colors"
        >
          <ChevronRight size={15} strokeWidth={1.75} />
        </button>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DOW.map((d) => (
          <div key={d} className="text-center text-label text-text-subtle font-medium py-0.5">
            {d}
          </div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: lead }).map((_, i) => (
          <div key={`b${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const date = `${month}-${String(i + 1).padStart(2, "0")}`;
          const status = statusFor(tasks, date);
          const count = tasks.filter((t) => t.date === date).length;
          const isToday = date === today;
          const isSel = date === selected;
          return (
            <button
              key={date}
              onClick={() => onPick(date)}
              title={`${date}${count ? ` · ${count} งาน` : ""}`}
              className={cn(
                "relative h-10 rounded-md flex flex-col items-center justify-center gap-1 text-small transition-colors border",
                isSel
                  ? "border-accent bg-accent-wash text-text font-semibold"
                  : isToday
                    ? "border-accent text-text font-semibold hover:bg-surface-hover"
                    : "border-transparent text-text-muted hover:bg-surface-hover"
              )}
            >
              <span className="num">{i + 1}</span>
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  status === "full" ? "bg-accent" : status === "partial" ? "bg-amber" : "bg-transparent"
                )}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
