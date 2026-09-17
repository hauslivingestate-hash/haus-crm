import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";
import type { TeamKpi, KpiAgentRow } from "@/lib/teamDashboard";

/* KPI ทีมขาย — the sales-process KPIs, and where each member stands on each one.
 *
 * HAUS V2's overview tracker, rebuilt on this app's `targets` and `kpi_template`. Ben,
 * 2026-09-17: adopt its model as-is. Three of its rules carry the design:
 *
 *   TWO SHAPES        a count KPI reads "7/10"; a percentage KPI reads "38%". The bar is
 *                     the same in both cases, so the eye can compare columns even though
 *                     the numbers underneath mean different things.
 *
 *   NOT TRACKED ≠ 0   someone with no target reads "7/–", muted, and is sorted below the
 *                     scored rows. Never "7/0 · 0%": that is a failure grade for a KPI
 *                     nobody set. Empty over fake zeros.
 *
 *   FOCUS WEEK        each KPI is the team's focus in one week of the month (1–4, set in
 *                     ตั้งค่า). The card is ordered by it, so it reads left-to-right as the
 *                     month's rhythm, and this week's KPI is ringed — but only when you
 *                     are looking at the current month. Highlighting week 2 while reading
 *                     เมษายน would point at a rhythm that ended months ago.
 *
 * Nothing here names a KPI. The list, the shapes and the weeks are rows in `kpi_template`.
 */
export function TeamKpiTracker({ kpis, rangeLabel }: { kpis: TeamKpi[]; rangeLabel: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>KPI ทีมขาย · {rangeLabel}</CardTitle>
        <span className="num text-small text-text-subtle">{kpis.length} KPI</span>
      </CardHeader>
      <CardContent>
        {kpis.length === 0 ? (
          <p className="py-6 text-center text-small text-text-subtle">
            ยังไม่ได้เลือก KPI สำหรับแดชบอร์ดทีม — เลือกได้ที่ ตั้งค่า ▸ เป้าหมาย KPI
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-x-5 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
            {kpis.map((k) => (
              <KpiColumn key={k.key} kpi={k} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function KpiColumn({ kpi }: { kpi: TeamKpi }) {
  // The column headline follows the shape: a count KPI totals the team's work against the
  // summed target, a percentage KPI is the team's own share of its whole population.
  const headline =
    kpi.tracked === 0
      ? "—"
      : kpi.shape === "pct"
        ? `${kpi.denom > 0 ? Math.round((kpi.done / kpi.denom) * 100) : 0}%`
        : `${kpi.done}/${kpi.denom}`;
  const met = kpi.denom > 0 && kpi.done >= kpi.denom;

  return (
    <section
      className={cn(
        "rounded-lg p-3 transition-colors",
        // The focus ring is a wash plus a border, not a heavy fill: it has to mark one
        // column out of six without making the other five look switched off.
        kpi.isFocus ? "border border-accent/35 bg-accent-wash" : "border border-transparent"
      )}
    >
      <header className="mb-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="flex min-w-0 items-baseline gap-1.5">
            <span className="truncate text-body font-semibold">{kpi.label}</span>
            {kpi.focusWeek != null && (
              <span
                className={cn(
                  "num shrink-0 rounded px-1 py-px text-[10px] font-medium",
                  kpi.isFocus ? "bg-accent text-text-onaccent" : "bg-surface-2 text-text-subtle"
                )}
                title={kpi.isFocus ? "โฟกัสของสัปดาห์นี้" : `โฟกัสสัปดาห์ที่ ${kpi.focusWeek}`}
              >
                W{kpi.focusWeek}
              </span>
            )}
          </h3>
          <span className={cn("num shrink-0 text-small font-semibold", met ? "text-green" : "text-text")}>
            {headline}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-label text-text-subtle" title={kpi.hint}>
          {kpi.hint}
        </p>
      </header>

      <ol className="flex flex-col gap-2">
        {kpi.rows.map((r) => (
          <Row key={r.code} row={r} />
        ))}
      </ol>
    </section>
  );
}

function Row({ row }: { row: KpiAgentRow }) {
  const untracked = row.pct == null;
  return (
    <li>
      <Link
        href={`/team/${encodeURIComponent(row.code)}`}
        className={cn(
          "grid grid-cols-[22px_1fr_auto] items-center gap-2 transition-colors hover:text-accent-ink",
          untracked ? "text-text-subtle" : "text-text"
        )}
        title={untracked ? "ยังไม่ได้ตั้งเป้าให้คนนี้" : undefined}
      >
        <Avatar
          name={row.nickname}
          src={row.avatarUrl}
          tone="neutral"
          className={cn("size-[22px] text-[9px]", untracked && "opacity-50")}
        />
        <span className="min-w-0">
          <span className="block truncate text-small">{row.nickname}</span>
          <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-surface-2">
            {!untracked && (
              <span
                className={cn("block h-full rounded-full", (row.pct ?? 0) >= 100 ? "bg-green" : "bg-accent")}
                // A 2% floor so one logged activity reads as a mark rather than as nothing.
                style={{ width: `${row.done > 0 ? Math.max(2, row.pct ?? 0) : 0}%` }}
              />
            )}
          </span>
        </span>
        <span
          className={cn(
            "num w-12 text-right text-small",
            untracked
              ? "text-text-subtle"
              : (row.pct ?? 0) >= 100
                ? "font-semibold text-green"
                : "font-medium"
          )}
        >
          {row.text}
        </span>
      </Link>
    </li>
  );
}
