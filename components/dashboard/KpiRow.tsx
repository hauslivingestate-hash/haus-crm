import { Banknote, Handshake, Target, UserPlus } from "lucide-react";
import { Stat } from "@/components/ui/Stat";
import { formatBaht } from "@/lib/format";
import { PERIOD_LABEL, type Range } from "@/lib/range";
import { REVENUE_BASIS_HINT } from "@/lib/deals";
import type { RevenueSummary } from "@/lib/salesDashboard";

/* The four headline numbers for the selected period.
 *
 * These used to be the top half of เป้ารายได้. Pulling them out into tiles (Ben,
 * 2026-09-15, the "Shopall" reference) leaves that card with the one thing a tile
 * cannot show — the pace bar — and means no figure is printed twice on the page.
 *
 * ── THE DELTA IS THREE-VALUED ───────────────────────────────────────────────────
 * Up is green, down is red, and a rise from zero is NEITHER: "+∞%" is not a number and
 * "+100%" is a lie, so it reads "เริ่มจากศูนย์" in plain grey. A custom range has no
 * previous period at all and shows no delta — labelling an invented window as "last
 * month" would be worse than silence. */
export function KpiRow({
  summary,
  newLeads,
  range,
}: {
  summary: RevenueSummary;
  /** Leads received in the window — the buyer funnel's cohort, so it cannot disagree
      with the Lead bar in ความเคลื่อนไหว below. */
  newLeads: number;
  range: Range;
}) {
  const { actual, previous, cases, target, basis, elapsed } = summary;
  const pct = target > 0 ? Math.round((actual / target) * 100) : null;
  const behind = target > 0 && elapsed < 1 && (pct ?? 0) < elapsed * 100;

  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      <Stat
        icon={Banknote}
        label={`รายได้ · ${range.label}`}
        value={formatBaht(actual)}
        delta={revenueDelta(actual, previous, range.compareLabel)}
        help={`ค่าคอมเต็มจำนวนที่บริษัทได้รับจากเจ้าของ (ยังไม่หักภาษี/ส่วนแบ่ง) · ${REVENUE_BASIS_HINT[basis]}`}
      />
      <Stat
        icon={Target}
        label="ทำได้ตามเป้า"
        value={pct == null ? "—" : `${pct}%`}
        hint={
          target > 0
            ? `จากเป้า ${formatBaht(target)} ${PERIOD_LABEL[summary.targetPeriod]}`
            : "ยังไม่ได้ตั้งเป้าสำหรับช่วงนี้"
        }
        delta={
          behind
            ? { value: "ตามหลังจังหวะเวลา", positive: false, label: `ผ่านมาแล้ว ${Math.round(elapsed * 100)}%` }
            : undefined
        }
      />
      <Stat icon={Handshake} label="ดีลที่ปิดได้" value={cases} hint={range.label} />
      <Stat icon={UserPlus} label="ลีดใหม่" value={newLeads} hint={`รับเข้า${range.label}`} />
    </div>
  );
}

function revenueDelta(
  actual: number,
  previous: number | null,
  label: string | null
): { value: string; positive?: boolean; label?: string } | undefined {
  if (previous == null || !label) return undefined;
  if (previous === 0) {
    return actual > 0 ? { value: "เริ่มจากศูนย์", label } : { value: "ไม่มีรายได้", label };
  }
  const change = Math.round(((actual - previous) / previous) * 100);
  return {
    value: `${change > 0 ? "+" : ""}${change}%`,
    positive: change > 0 ? true : change < 0 ? false : undefined,
    label,
  };
}
