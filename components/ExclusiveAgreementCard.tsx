"use client";

import * as React from "react";
import { FileSignature, CalendarClock } from "lucide-react";
import { useChecklists } from "@/components/ChecklistProvider";
import { potentialGroup } from "@/lib/status";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";

// Exclusive-listing agreement window — the signed contract's start/end term. We commit to
// selling before it expires, so the end date drives an expiry warning (and, later, renewal
// reminders). Renders ONLY for Exclusive listings. Design-first: state lives in ChecklistProvider
// (in-memory, resets on reload); wire later = agreement_start / agreement_end columns.
export function ExclusiveAgreementCard({
  listingId,
  potential,
}: {
  listingId: string;
  potential: string | null | undefined;
}) {
  const { exclusiveAgreementFor, setExclusiveAgreement } = useChecklists();

  if (potentialGroup(potential) !== "exclusive") return null; // Exclusive tier only

  const { start, end } = exclusiveAgreementFor(listingId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSignature size={16} strokeWidth={1.75} className="text-accent" />
          สัญญา Exclusive
        </CardTitle>
        <ExpiryBadge end={end} />
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-small">
        <DateRow
          label="เริ่มสัญญา"
          value={start}
          max={end ?? undefined}
          onChange={(v) => setExclusiveAgreement(listingId, { start: v })}
        />
        <DateRow
          label="สิ้นสุดสัญญา"
          value={end}
          min={start ?? undefined}
          onChange={(v) => setExclusiveAgreement(listingId, { end: v })}
        />
        {start && end && (
          <div className="flex items-center justify-between border-t border-border pt-2.5 text-text-subtle">
            <span>ระยะสัญญา</span>
            <span className="text-text-muted">{termLabel(start, end)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DateRow({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: string | null;
  min?: string;
  max?: string;
  onChange: (value: string | null) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-text-subtle">{label}</span>
      <input
        type="date"
        value={value ?? ""}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value || null)}
        className="h-7 rounded-md border border-border-strong bg-surface px-2 num text-small text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      />
    </div>
  );
}

// Days-until-expiry pill: red once expired / expiring today, amber inside 30 days, green beyond.
function ExpiryBadge({ end }: { end: string | null }) {
  if (!end) return <Pill tone="neutral">ยังไม่ระบุ</Pill>;
  const left = -daysSince(end); // days until expiry (negative = past)
  const { text, tone } =
    left < 0
      ? { text: `หมดอายุแล้ว ${-left} วัน`, tone: "red" as const }
      : left === 0
        ? { text: "หมดอายุวันนี้", tone: "red" as const }
        : left <= 30
          ? { text: `เหลือ ${left} วัน`, tone: "amber" as const }
          : { text: `เหลือ ${left} วัน`, tone: "green" as const };
  return (
    <Pill tone={tone}>
      <CalendarClock size={11} strokeWidth={1.75} /> {text}
    </Pill>
  );
}

// Whole days between `dateStr` (YYYY-MM-DD) and today. Positive = in the past.
function daysSince(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${dateStr}T00:00:00`);
  return Math.round((today.getTime() - d.getTime()) / 86_400_000);
}

// Human term from start→end: prefers whole-month/year granularity (agreements are typically 6mo/1yr).
function termLabel(start: string, end: string): string {
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  if (e <= s) return "—";
  let months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
  if (e.getDate() < s.getDate()) months -= 1; // not a full final month yet
  if (months < 1) {
    const days = Math.round((e.getTime() - s.getTime()) / 86_400_000);
    return `${days} วัน`;
  }
  const years = Math.floor(months / 12);
  const rem = months % 12;
  const parts: string[] = [];
  if (years) parts.push(`${years} ปี`);
  if (rem) parts.push(`${rem} เดือน`);
  return parts.join(" ");
}
