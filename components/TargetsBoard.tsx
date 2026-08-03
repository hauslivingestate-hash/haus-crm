"use client";

import * as React from "react";
import { Plus, Zap } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatBaht } from "@/lib/format";
import {
  listTargets,
  targetProgress,
  isAutoTarget,
  isFocusWeek,
  currentWeekOfMonth,
  type Target,
} from "@/lib/momentum";
import { GoalDetailSheet, type GoalDraft } from "@/components/GoalDetailSheet";
import { useActivities } from "@/components/ActivityProvider";
import type { Activity } from "@/lib/actions";
import { cn } from "@/lib/cn";

export function TargetsBoard({ agent, title = "เป้าหมายเดือนนี้" }: { agent: string; title?: string }) {
  // Local copy so manual +1 and adding personal goals are interactive.
  const [targets, setTargets] = React.useState<Target[]>(() => listTargets(agent));
  const [addOpen, setAddOpen] = React.useState(false);
  const nextId = React.useRef(0);
  const week = currentWeekOfMonth();
  // The live log — activity-source targets recompute as Daily-Plan tasks are ticked.
  const { activities } = useActivities();

  const bump = (id: string) =>
    setTargets((ts) =>
      ts.map((t) => (t.id === id ? { ...t, manualCurrent: t.manualCurrent + 1 } : t))
    );

  const addGoal = (d: GoalDraft) =>
    setTargets((ts) => [
      ...ts,
      {
        id: `g_new_${nextId.current++}`,
        agent,
        month: ts[0]?.month ?? "",
        label: d.label,
        kind: d.kind,
        target: d.target,
        manualCurrent: 0,
        source: d.source,
        activityType: d.activityType,
        owner: "stretch",
      },
    ]);

  const official = targets.filter((t) => t.owner === "official");
  const stretch = targets.filter((t) => t.owner === "stretch");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <span className="text-label text-text-subtle">ก.ค. 2569</span>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Group
          label="ทางการ (ตั้งโดยหัวหน้า)"
          targets={official}
          onBump={bump}
          week={week}
          activities={activities}
          note={`โฟกัสสัปดาห์ที่ ${week}`}
        />
        <Group
          label="เป้าหมายส่วนตัว"
          targets={stretch}
          onBump={bump}
          week={week}
          activities={activities}
          action={
            <Button variant="secondary" size="sm" onClick={() => setAddOpen(true)}>
              <Plus size={13} strokeWidth={2} /> เพิ่ม
            </Button>
          }
        />
      </CardContent>

      <GoalDetailSheet open={addOpen} onSubmit={addGoal} onClose={() => setAddOpen(false)} />
    </Card>
  );
}

function Group({
  label,
  targets,
  onBump,
  week,
  action,
  note,
  activities,
}: {
  label: string;
  targets: Target[];
  onBump: (id: string) => void;
  week: number;
  action?: React.ReactNode;
  note?: string;
  activities: Activity[];
}) {
  if (targets.length === 0 && !action) return null;
  return (
    <div>
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-baseline gap-2 min-w-0">
          <div className="text-label uppercase text-text-subtle">{label}</div>
          {note && <div className="text-label text-text-subtle num shrink-0">· {note}</div>}
        </div>
        {action}
      </div>
      <div className="flex flex-col gap-3">
        {targets.map((t) => (
          <TargetRow key={t.id} target={t} week={week} onBump={() => onBump(t.id)} activities={activities} />
        ))}
      </div>
    </div>
  );
}

function TargetRow({
  target: t,
  week,
  onBump,
  activities,
}: {
  target: Target;
  week: number;
  onBump: () => void;
  /** LIVE log (ActivityProvider) — so an activity-source target moves the moment a
   *  Daily-Plan task is ticked, instead of reading the frozen sample array. */
  activities: Activity[];
}) {
  const { current, denom, pct } = targetProgress(t, activities);
  const auto = isAutoTarget(t);
  const focus = isFocusWeek(t, week);
  const fmt = (n: number) => (t.kind === "baht" ? formatBaht(n) : String(n));

  // Ratio KPIs show the percentage as the headline with the raw fraction beneath;
  // count/baht show the running value over the goal.
  const headline = t.kind === "ratio" ? `${pct}%` : fmt(current);
  const sub = t.kind === "ratio" ? `${current} / ${denom}` : `/ ${fmt(t.target)}`;

  return (
    <div className={cn(focus && "border-l-2 border-accent pl-2.5 -ml-2.5")}>
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
              className="num text-label font-semibold text-accent border border-accent rounded px-1.5 h-6 hover:bg-accent-wash transition-colors"
            >
              +1
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
