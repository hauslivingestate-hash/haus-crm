/* The dashboard's time filter — วันนี้ / 7 วัน / เดือนนี้ / ไตรมาสนี้ / ปีนี้ + กำหนดเอง.
 *
 * Ported from Klaichan CRM's lib/range.ts (which took it from W Property), with the
 * date arithmetic rewritten onto lib/momentum.ts's UTC-parsed helpers so there is one
 * way to add a day in this repo rather than two.
 *
 * ── WHY THE RANGE LIVES IN THE URL AND NOT IN REACT STATE ───────────────────────
 * The dashboard is a server component. The range has to be readable BEFORE any JS
 * runs or every card renders twice — once empty, once right. Putting it in the query
 * string also makes a filtered dashboard shareable and bookmarkable, and makes the
 * browser's back button work on it, neither of which a context value can do.
 *
 * ── EVERY BOUNDARY IS BANGKOK'S ─────────────────────────────────────────────────
 * `todayISO()` is pinned to Asia/Bangkok (see lib/momentum.ts). Vercel runs in UTC:
 * between 00:00 and 07:00 ICT a UTC "today" is still yesterday, so "เดือนนี้" opened
 * at 1am on the 1st would quietly show the whole of last month.
 *
 * Client-safe: pure date arithmetic, no Supabase import.
 */

import { addDays, todayISO } from "@/lib/momentum";

/** How long a preset covers — and, later, the length a target is set against. */
export type PeriodLength = "day" | "week" | "month" | "quarter" | "year";

export type RangeKey = "today" | "7d" | "mtd" | "qtd" | "ytd" | "custom";

export interface RangePreset {
  key: Exclude<RangeKey, "custom">;
  label: string;
  /** Which target length this range should be measured against. */
  period: PeriodLength;
  /** Caption for the period-over-period delta. */
  compare: string;
}

/* Five presets. Deliberately no "เดือนที่แล้ว" / "ไตรมาสที่แล้ว": a dashboard is a
   working surface for the period you are IN, and every preset added costs width in a
   bar that gets read on a phone. A past period is reachable through กำหนดเอง. */
export const RANGE_PRESETS: RangePreset[] = [
  { key: "today", label: "วันนี้", period: "day", compare: "เทียบเมื่อวาน" },
  { key: "7d", label: "7 วัน", period: "week", compare: "เทียบ 7 วันก่อน" },
  { key: "mtd", label: "เดือนนี้", period: "month", compare: "เทียบเดือนก่อน" },
  { key: "qtd", label: "ไตรมาสนี้", period: "quarter", compare: "เทียบไตรมาสก่อน" },
  { key: "ytd", label: "ปีนี้", period: "year", compare: "เทียบปีก่อน" },
];

export const DEFAULT_RANGE: RangeKey = "mtd";

/** A resolved range: what to filter on, what to call it, what to compare it against. */
export interface Range {
  key: RangeKey;
  /** Inclusive ISO bounds. `end` is never in the future — a month-to-date window ends
      today, not on the 31st, or a progress bar would be measuring days that have not
      happened yet. */
  start: string;
  end: string;
  label: string;
  period: PeriodLength;
  /** The equivalent window one period earlier, for the delta. Null for a custom range:
      an arbitrary window has no canonical prior period, and inventing one (the
      preceding N days) would be labelled as something it is not. */
  prev: { start: string; end: string } | null;
  compareLabel: string | null;
  /** How much of `period` has elapsed, 0–1. Month-to-date on the 9th of a 31-day month
      is 0.29 — the pace marker. Always 1 for a custom range, which is its own whole
      period by definition. */
  elapsed: number;
}

/* ---------- date arithmetic ------------------------------------------------------
   All of it goes through UTC-parsed dates (lib/momentum.ts's convention) and only ever
   reads calendar components, so none of it drifts a day on a UTC server. */

/** Inclusive whole days between two ISO dates. */
export function dayspan(start: string, end: string): number {
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${end}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000) + 1;
}

const iso = (d: Date): string => d.toISOString().slice(0, 10);

const monthStart = (day: string) => `${day.slice(0, 7)}-01`;
const yearStart = (day: string) => `${day.slice(0, 4)}-01-01`;

function quarterStart(day: string): string {
  const m = Number(day.slice(5, 7));
  const q = Math.floor((m - 1) / 3) * 3 + 1;
  return `${day.slice(0, 4)}-${String(q).padStart(2, "0")}-01`;
}

/** Last day of the month `day` falls in. Day 0 of the next month IS the last day of
    this one, so leap years and 30/31 need no lookup table. */
function monthEnd(day: string): string {
  const y = Number(day.slice(0, 4));
  const m = Number(day.slice(5, 7));
  return iso(new Date(Date.UTC(y, m, 0)));
}

function quarterEnd(day: string): string {
  const s = quarterStart(day);
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7));
  return iso(new Date(Date.UTC(y, m + 2, 0)));
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/* ---------- resolution ----------------------------------------------------------- */

/**
 * Turn the URL's search params into a Range.
 *
 * Tolerant by design: an unknown key, a malformed date, or a backwards custom window
 * all fall back to the default rather than throwing. This is a page reached from shared
 * links and hand-edited URLs — a broken filter must never be a broken page.
 */
export function resolveRange(
  params: { range?: string | string[]; from?: string | string[]; to?: string | string[] } = {}
): Range {
  const today = todayISO();
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const key = one(params.range);
  const from = one(params.from);
  const to = one(params.to);

  if (key === "custom" && from && to && ISO_DATE.test(from) && ISO_DATE.test(to) && from <= to && from <= today) {
    /* Clamped at today for the same reason mtd is. `from <= today` sits on the guard
       rather than being clamped alongside `to`, because a window that STARTS in the
       future has no valid reading at all: clamping only the end would leave start > end
       and make `dayspan` negative. A URL like that falls through to the default. */
    const end = to > today ? today : to;
    return {
      key: "custom",
      start: from,
      end,
      label: `${shortDate(from)} – ${shortDate(end)}`,
      // Measured against the daily target × its length — the only reading that doesn't
      // need a period the window doesn't have.
      period: "day",
      prev: null,
      compareLabel: null,
      elapsed: 1,
    };
  }

  const preset =
    RANGE_PRESETS.find((r) => r.key === key) ?? RANGE_PRESETS.find((r) => r.key === DEFAULT_RANGE)!;

  switch (preset.key) {
    case "today":
      return build(preset, today, today, addDays(today, -1), addDays(today, -1), 1);

    case "7d": {
      // Rolling and inclusive of today, so "7 วัน" is always seven days — not "since
      // Monday", which on a Tuesday would be two.
      const start = addDays(today, -6);
      return build(preset, start, today, addDays(start, -7), addDays(start, -1), 1);
    }

    case "mtd": {
      const start = monthStart(today);
      const prevEnd = addDays(start, -1);
      // The prior period is the WHOLE previous month, not its first N days. A
      // month-to-date figure compared against a partial month flatters itself on the
      // 30th and punishes itself on the 2nd.
      return build(
        preset, start, today,
        monthStart(prevEnd), prevEnd,
        dayspan(start, today) / dayspan(start, monthEnd(today))
      );
    }

    case "qtd": {
      const start = quarterStart(today);
      const prevEnd = addDays(start, -1);
      return build(
        preset, start, today,
        quarterStart(prevEnd), prevEnd,
        dayspan(start, today) / dayspan(start, quarterEnd(today))
      );
    }

    case "ytd":
    default: {
      const start = yearStart(today);
      const prevEnd = addDays(start, -1);
      return build(
        preset, start, today,
        yearStart(prevEnd), prevEnd,
        dayspan(start, today) / dayspan(start, `${today.slice(0, 4)}-12-31`)
      );
    }
  }
}

function build(
  preset: RangePreset,
  start: string,
  end: string,
  prevStart: string,
  prevEnd: string,
  elapsed: number
): Range {
  return {
    key: preset.key,
    start,
    end,
    label: preset.label,
    period: preset.period,
    prev: { start: prevStart, end: prevEnd },
    compareLabel: preset.compare,
    elapsed: Math.min(1, Math.max(0, elapsed)),
  };
}

const TH_MON = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

/** "2026-09-10" → "10 ก.ย." — the custom range's own label. */
export function shortDate(day: string): string {
  const [, m, d] = day.split("-");
  return `${Number(d)} ${TH_MON[Number(m) - 1] ?? ""}`;
}

/** Rebuild the query string for a range. One place, so the bar, a deep link and any
    future "ดูช่วงนี้" button all agree on the shape. */
export function rangeParams(key: RangeKey, from?: string, to?: string): string {
  if (key === "custom" && from && to) return `?range=custom&from=${from}&to=${to}`;
  if (key === DEFAULT_RANGE) return "";
  return `?range=${key}`;
}

/* ---------- targets --------------------------------------------------------------- */

/**
 * The period key a range falls in — 'YYYY-MM' for a month, 'YYYY-Qn' for a quarter, and
 * so on. This is what an OVERRIDE row in `targets` is keyed by; a standing target uses ''
 * and needs none.
 */
export function periodKeyOf(range: Range): string {
  switch (range.period) {
    case "day":
      return range.start;
    case "week":
      return range.start; // the rolling window's first day
    case "month":
      return range.start.slice(0, 7);
    case "quarter":
      return `${range.start.slice(0, 4)}-Q${Math.floor((Number(range.start.slice(5, 7)) - 1) / 3) + 1}`;
    case "year":
      return range.start.slice(0, 4);
  }
}

/**
 * How many of `period` this range spans.
 *
 * Always 1 for a preset — the whole point of matching preset → period is that the
 * denominator is exactly one target, never a fraction of one. Only a custom window
 * multiplies, and it multiplies the DAILY figure by its length, which is the one
 * interpretation that needs no invented period.
 */
export function periodMultiple(range: Range): number {
  return range.key === "custom" ? dayspan(range.start, range.end) : 1;
}

export const PERIOD_LABEL: Record<PeriodLength, string> = {
  day: "ต่อวัน",
  week: "ต่อสัปดาห์",
  month: "ต่อเดือน",
  quarter: "ต่อไตรมาส",
  year: "ต่อปี",
};

export const PERIOD_ORDER: PeriodLength[] = ["day", "week", "month", "quarter", "year"];
