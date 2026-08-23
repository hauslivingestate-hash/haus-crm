"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileSignature, CalendarClock } from "lucide-react";
import { setExclusiveAgreement } from "@/lib/mutations/checklists";
import { daysSince, type ExclusiveAgreement } from "@/lib/checklists";
import { potentialGroup } from "@/lib/status";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";

// Exclusive-listing agreement window — the signed contract's start/end term. We commit to
// selling before it expires, so the end date drives an expiry warning (and, later, renewal
// reminders). Renders ONLY for Exclusive listings.
//
// The dates live on the listing (agreement_start / agreement_end), not on
// main_10_potential_listing — the A-List sync trigger deletes a listing's main_10 row the
// moment it drops out of the criteria, which would take the signed contract's dates with it.
export function ExclusiveAgreementCard({
  listingId,
  potential,
  agreement,
  canEdit,
}: {
  listingId: string;
  potential: string | null | undefined;
  agreement: ExclusiveAgreement;
  /** Read-only for anyone who cannot edit the listing. */
  canEdit: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [, start_] = React.useTransition();

  const save = (patch: Partial<ExclusiveAgreement>) => {
    setBusy(true);
    setError(null);
    void (async () => {
      try {
        const res = await setExclusiveAgreement(listingId, patch);
        if (!res.ok) setError(res.error);
        else start_(() => router.refresh());
      } catch (e) {
        setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
      } finally {
        setBusy(false);
      }
    })();
  };

  if (potentialGroup(potential) !== "exclusive") return null; // Exclusive tier only

  const { start, end } = agreement;

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
          disabled={!canEdit || busy}
          onChange={(v) => save({ start: v })}
        />
        <DateRow
          label="สิ้นสุดสัญญา"
          value={end}
          min={start ?? undefined}
          disabled={!canEdit || busy}
          onChange={(v) => save({ end: v })}
        />
        {error && <div className="text-small text-red">{error}</div>}
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
  disabled,
  onChange,
}: {
  label: string;
  value: string | null;
  min?: string;
  max?: string;
  disabled: boolean;
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
        disabled={disabled}
        onChange={(e) => onChange(e.target.value || null)}
        className="h-7 rounded-md border border-border-strong bg-surface px-2 num text-small text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60"
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
