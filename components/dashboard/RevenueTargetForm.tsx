"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PERIOD_LABEL, PERIOD_ORDER, type PeriodLength } from "@/lib/range";
import { setRevenueTargets } from "@/lib/mutations/targets";

/* ตั้งเป้ารายได้ — all five period lengths in one form.
 *
 * ── WHY FIVE INPUTS AND NOT ONE ─────────────────────────────────────────────────
 * The dashboard's bar needs a real denominator whatever the filter says. Storing one
 * monthly figure and dividing it by days — which is what this app did until 2026-09-10 —
 * is arithmetic pretending to be a goal: Thai property is not flat across the year, and
 * a Songkran month is not a March. So the leader sets a real number per length. Klaichan
 * CRM reached the same conclusion after trying the divided version first.
 *
 * ── ONE FORM, TWO HOMES ─────────────────────────────────────────────────────────
 * Used inline on the dashboard's เป้ารายได้ card (for someone setting their own) and on
 * an employee's record (for a leader setting a sale's). One component, so the two can
 * never drift into asking for different things.
 *
 * Blank or 0 removes that period's target rather than storing zero — "not set" and
 * "your target is nothing" read very differently on the card.
 */
export function RevenueTargetForm({
  employeeCode,
  standing,
  onDone,
}: {
  employeeCode: string;
  /** period → baht. Missing or 0 = not set. */
  standing: Record<string, number>;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [values, setValues] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(PERIOD_ORDER.map((p) => [p, standing[p] ? String(standing[p]) : ""]))
  );
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const save = async () => {
    setError(null);
    // Thousands separators get pasted in constantly; strip rather than reject.
    const parsed = Object.fromEntries(
      PERIOD_ORDER.map((p) => [p, Math.max(0, Math.round(Number(values[p].replace(/,/g, "")) || 0))])
    ) as Partial<Record<PeriodLength, number>>;

    setSaving(true);
    const res = await setRevenueTargets(employeeCode, parsed);
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onDone?.();
    router.refresh();
  };

  return (
    <div>
      <p className="mb-3 text-small text-text-muted">
        ตั้งเป้า <b>ค่าคอมเต็มจำนวนที่บริษัทได้รับ</b> จากดีลที่เซ็นสัญญาแล้ว · ไม่ใช่ยอดที่เซลส์ได้รับจริงหลังหักส่วนแบ่ง · เว้นว่างหรือใส่ 0 เพื่อไม่ตั้งเป้า
      </p>
      <div className="flex flex-col gap-2">
        {PERIOD_ORDER.map((p) => (
          <label key={p} className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-small text-text-muted">{PERIOD_LABEL[p]}</span>
            <span className="text-small text-text-subtle">฿</span>
            <input
              value={values[p]}
              inputMode="numeric"
              placeholder="0"
              onChange={(e) => setValues((v) => ({ ...v, [p]: e.target.value }))}
              className="num min-w-0 flex-1 h-9 rounded-md border border-border-strong bg-surface px-3 text-body text-text outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          </label>
        ))}
      </div>
      {error && <p className="mt-2 text-small text-red">{error}</p>}
      <Button onClick={() => void save()} disabled={saving} className="mt-4 w-full justify-center">
        <Check size={15} strokeWidth={2} /> {saving ? "กำลังบันทึก…" : "บันทึกเป้าหมาย"}
      </Button>
    </div>
  );
}
