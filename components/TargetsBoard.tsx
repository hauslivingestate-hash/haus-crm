"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Zap, Trash2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatBaht, TH_MONTHS } from "@/lib/format";
import {
  targetProgress,
  isAutoTarget,
  isFocusWeek,
  currentWeekOfMonth,
  type ActivityTotals,
  type Target,
} from "@/lib/momentum";
import { GoalDetailSheet, type GoalDraft } from "@/components/GoalDetailSheet";
import { createTarget, bumpTarget, deleteTarget } from "@/lib/mutations/targets";
import type { PlanData } from "@/lib/plan";
import { cn } from "@/lib/cn";

// Monthly targets, read from and written to `targets` (Phase 5 #6).
//
// Progress comes from two places by design: an `activity`-source goal is summed from the
// real `activities` table (so ticking a linked task moves it), while kpi/pipeline/manual
// goals carry a stored number. Only `manual` gets the +1 button — bumping anything else by
// hand would either be overwritten by the next recompute or double-counted.

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${TH_MONTHS[m - 1]} ${y}`;
}

export function TargetsBoard({
  plan,
  title = "เป้าหมายเดือนนี้",
}: {
  plan: PlanData;
  title?: string;
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Stay busy until the refresh actually lands, not just until the write returns — a second
  // +1 fired into that gap would act on the number the previous render showed.
  const [refreshing, startRefresh] = React.useTransition();
  const busy = saving || refreshing;
  const week = currentWeekOfMonth(plan.today);

  // try/catch because a server action can reject outright (dropped connection, aborted
  // navigation) rather than return `{ok:false}` — swallowing that would leave the board
  // showing a goal that was never written.
  const run = async (fn: () => Promise<{ ok: true } | { ok: false; error: string } | { ok: true; id: number }>) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fn();
      if (!res.ok) setError(res.error);
      else startRefresh(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  };

  const addGoal = (d: GoalDraft) =>
    void run(() =>
      createTarget({
        month: plan.month,
        label: d.label,
        kind: d.kind,
        target: d.target,
        source: d.source,
        activityType: d.activityType ?? null,
        owner: "stretch",
      })
    );

  const official = plan.targets.filter((t) => t.owner === "official");
  const stretch = plan.targets.filter((t) => t.owner === "stretch");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <span className="text-label text-text-subtle num">{monthLabel(plan.month)}</span>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error && (
          <div className="rounded-md bg-red-bg/50 px-3 py-2 text-small text-red">{error}</div>
        )}

        <Group
          label="ทางการ (ตั้งโดยหัวหน้า)"
          targets={official}
          totals={plan.activityTotals}
          monthRevenue={plan.monthRevenue}
          week={week}
          busy={busy}
          note={`โฟกัสสัปดาห์ที่ ${week}`}
          emptyNote={
            plan.canSetOfficial
              ? "ยังไม่มีเป้าหมายทางการของเดือนนี้"
              : "หัวหน้ายังไม่ได้ตั้งเป้าหมายของเดือนนี้"
          }
          onBump={(id) => void run(() => bumpTarget(id))}
          onDelete={plan.canSetOfficial ? (id) => void run(() => deleteTarget(id)) : undefined}
        />
        <Group
          label="เป้าหมายส่วนตัว"
          targets={stretch}
          totals={plan.activityTotals}
          monthRevenue={plan.monthRevenue}
          week={week}
          busy={busy}
          emptyNote="ยังไม่มีเป้าหมายส่วนตัว"
          onBump={(id) => void run(() => bumpTarget(id))}
          onDelete={plan.canStretch ? (id) => void run(() => deleteTarget(id)) : undefined}
          action={
            plan.canStretch ? (
              <Button variant="secondary" size="sm" onClick={() => setAddOpen(true)} disabled={busy}>
                <Plus size={13} strokeWidth={2} /> เพิ่ม
              </Button>
            ) : undefined
          }
        />
      </CardContent>

      <GoalDetailSheet
        open={addOpen}
        actionGroups={plan.actionGroups}
        onSubmit={addGoal}
        onClose={() => setAddOpen(false)}
      />
    </Card>
  );
}

function Group({
  label,
  targets,
  totals,
  monthRevenue,
  week,
  busy,
  action,
  note,
  emptyNote,
  onBump,
  onDelete,
}: {
  label: string;
  targets: Target[];
  totals: ActivityTotals;
  /** This month's signed commission — what a revenue-source goal measures itself against. */
  monthRevenue: number;
  week: number;
  busy: boolean;
  action?: React.ReactNode;
  note?: string;
  emptyNote: string;
  onBump: (id: number) => void;
  onDelete?: (id: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-baseline gap-2 min-w-0">
          <div className="text-label uppercase text-text-subtle">{label}</div>
          {note && targets.length > 0 && (
            <div className="text-label text-text-subtle num shrink-0">· {note}</div>
          )}
        </div>
        {action}
      </div>
      {targets.length === 0 ? (
        <p className="text-small text-text-subtle">{emptyNote}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {targets.map((t) => (
            <TargetRow
              key={t.id}
              target={t}
              totals={totals}
              monthRevenue={monthRevenue}
              week={week}
              busy={busy}
              onBump={() => onBump(t.id)}
              onDelete={onDelete ? () => onDelete(t.id) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TargetRow({
  target: t,
  totals,
  monthRevenue,
  week,
  busy,
  onBump,
  onDelete,
}: {
  target: Target;
  /** This month's real activity totals — an activity-source goal moves the moment a linked
   *  Daily-Plan task is ticked, because the tick writes the row these totals sum. */
  totals: ActivityTotals;
  /** This month's signed commission — what a revenue-source goal measures itself against. */
  monthRevenue: number;
  week: number;
  busy: boolean;
  onBump: () => void;
  onDelete?: () => void;
}) {
  const { current, denom, pct } = targetProgress(t, totals, monthRevenue);
  const auto = isAutoTarget(t);
  const focus = isFocusWeek(t, week);
  const fmt = (n: number) => (t.kind === "baht" ? formatBaht(n) : String(n));

  // Ratio KPIs show the percentage as the headline with the raw fraction beneath;
  // count/baht show the running value over the goal.
  const headline = t.kind === "ratio" ? `${pct}%` : fmt(current);
  const sub = t.kind === "ratio" ? `${current} / ${denom}` : `/ ${fmt(t.target)}`;

  return (
    <div className={cn("group", focus && "border-l-2 border-accent pl-2.5 -ml-2.5")}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-body inline-flex items-center gap-1.5 min-w-0">
          {focus && <span className="size-1.5 rounded-full bg-accent shrink-0" />}
          <span className={cn("truncate", focus && "font-medium")}>{t.label}</span>
          {t.focusLabel && (
            <span
              className={cn(
                "text-label num shrink-0 rounded px-1.5 py-0.5",
                focus ? "bg-accent-wash text-accent" : "bg-surface-2 text-text-subtle"
              )}
            >
              {t.focusLabel}
            </span>
          )}
          {auto && (t.source === "activity" || t.source === "pipeline") && (
            <span
              className="inline-flex items-center gap-0.5 text-label text-green shrink-0"
              title={t.source === "pipeline" ? "อัปเดตจากรายได้จริงในระบบ" : "อัปเดตอัตโนมัติจากกิจกรรม"}
            >
              <Zap size={10} strokeWidth={2} /> auto
            </span>
          )}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <span className="num text-small text-text-muted">
            {headline} <span className="text-text-subtle">{sub}</span>
          </span>
          {!auto && (
            <button
              onClick={onBump}
              disabled={busy}
              className="num text-label font-semibold text-accent border border-accent rounded px-1.5 h-6 hover:bg-accent-wash transition-colors disabled:opacity-50"
            >
              +1
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              disabled={busy}
              aria-label={`ลบเป้าหมาย ${t.label}`}
              className="size-6 grid place-items-center rounded text-text-subtle opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-red-bg hover:text-red transition-all disabled:opacity-50"
            >
              <Trash2 size={13} strokeWidth={1.75} />
            </button>
          )}
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            pct >= 100 ? "bg-green" : focus ? "bg-accent" : "bg-accent/70"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
