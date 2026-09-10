"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import { stageMeta } from "@/lib/pipeline";
import type { ActivityTotal, FunnelStep, StageMovement } from "@/lib/salesDashboard";

/* ความเคลื่อนไหว — what happened in the selected window, split into the two sides of
 * the business. Ported from Klaichan CRM's StageActivityCard.
 *
 * ── THE SPLIT COMES FROM THE DATA MODEL, not a list in this file ────────────────
 * `action_type.group_label` says whether an action belongs to the property side
 * (acquisition: talking an owner into a listing, surveying a building) or the buyer's
 * (a showing, a follow-up). This card reads it, so the halves can never drift from what
 * someone sets in ตั้งค่า. Their order is `sort_order`, also stored — a stage or action
 * inserted in the middle re-orders this card with no code change.
 *
 * ── THE BUYER HALF HAS TWO VIEWS, AND BOTH ARE KEYED TO THE PIPELINE ────────────
 * Ben's point on Klaichan applies identically here: actions and stage movement are
 * different units, and only one of them is work a person did. Five calls to a buyer
 * parked at Follow is five actions and zero movement; dragging one lead Lead → Call →
 * Follow is two moves and maybe one call. Hence the toggle:
 *
 *   งานที่ทำ (default)  how many ACTIONS were logged
 *   กรวยการขาย          how far the leads RECEIVED in this window actually got
 *
 * งานที่ทำ is the default because effort is the part a person controls.
 *
 * THE FUNNEL IS A COHORT, which is why it nests: every step counts everyone at or beyond
 * it, so the bars can only narrow and the percentages are real conversion rates.
 */
export function MovementCard({
  activity,
  funnel,
  stages,
  rangeLabel,
  compareLabel,
}: {
  activity: ActivityTotal[];
  funnel: FunnelStep[];
  /** Where leads stand right now — the context under the movement numbers. */
  stages: StageMovement[];
  rangeLabel: string;
  compareLabel: string | null;
}) {
  const [view, setView] = React.useState<"actions" | "funnel">("actions");

  // Grouped by the stored vocabulary, in the stored order. An action whose kind was
  // deleted from ตั้งค่า lands in "อื่นๆ" rather than vanishing from the total.
  const groups: { label: string; rows: ActivityTotal[] }[] = [];
  for (const row of activity) {
    let g = groups.find((x) => x.label === row.group);
    if (!g) groups.push((g = { label: row.group, rows: [] }));
    g.rows.push(row);
  }

  const max = activity.reduce((m, r) => Math.max(m, r.total), 0);
  const cohort = funnel[0]?.cohort ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>ความเคลื่อนไหว · {rangeLabel}</CardTitle>
        <div className="inline-flex items-center gap-0.5 rounded-md bg-surface-2 p-0.5">
          {(["actions", "funnel"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={cn(
                "h-6 rounded-[6px] px-2.5 text-small transition-colors",
                view === v ? "bg-surface text-text shadow-card" : "text-text-muted hover:text-text"
              )}
            >
              {v === "actions" ? "งานที่ทำ" : "กรวยการขาย"}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {view === "actions" ? (
          groups.length === 0 ? (
            <p className="text-body text-text-muted">
              ยังไม่มีกิจกรรมที่บันทึกไว้ในช่วงนี้ — ติ๊กงานในแผนวันนี้แล้วระบบจะบันทึกให้เอง
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {groups.map((g) => (
                <section key={g.label}>
                  <h3 className="mb-2 text-small font-medium text-text-muted">{g.label}</h3>
                  <ul className="flex flex-col gap-2">
                    {g.rows.map((r) => {
                      const delta = r.prev == null ? null : r.total - r.prev;
                      return (
                        <li key={r.action} className="flex items-center gap-3">
                          <span className="w-24 shrink-0 truncate text-body text-text">{r.action}</span>
                          <span className="block h-1.5 min-w-0 flex-1 rounded-full bg-surface-2">
                            <span
                              className="block h-full rounded-full bg-accent"
                              style={{ width: max > 0 ? `${(r.total / max) * 100}%` : "0%" }}
                            />
                          </span>
                          <span className="num w-10 shrink-0 text-right text-body text-text">
                            {formatNumber(r.total)}
                          </span>
                          <span
                            className={cn(
                              "num w-12 shrink-0 text-right text-small",
                              delta == null || delta === 0
                                ? "text-text-subtle"
                                : delta > 0
                                  ? "text-green"
                                  : "text-red"
                            )}
                            title={compareLabel ?? undefined}
                          >
                            {delta == null ? "" : delta === 0 ? "±0" : delta > 0 ? `+${delta}` : `${delta}`}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
              {compareLabel && (
                <p className="text-small text-text-subtle">ตัวเลขทางขวา {compareLabel}</p>
              )}
            </div>
          )
        ) : (
          <Funnel funnel={funnel} stages={stages} cohort={cohort} />
        )}
      </CardContent>
    </Card>
  );
}

function Funnel({
  funnel,
  stages,
  cohort,
}: {
  funnel: FunnelStep[];
  stages: StageMovement[];
  cohort: number;
}) {
  const standing = new Map(stages.map((s) => [s.stage, s]));

  if (cohort === 0) {
    return (
      <p className="text-body text-text-muted">
        ไม่มีลีดที่รับเข้ามาในช่วงนี้ — กรวยการขายตามกลุ่มลีดที่รับเข้าในช่วงที่เลือกเท่านั้น
      </p>
    );
  }

  return (
    <>
      <p className="mb-3 text-small text-text-muted">
        จากลีด <span className="num font-semibold text-text">{formatNumber(cohort)}</span> รายที่รับเข้ามาในช่วงนี้ — ไปได้ไกลแค่ไหน
      </p>
      <ul className="flex flex-col gap-2">
        {funnel.map((f) => {
          const meta = stageMeta(f.stage);
          const pct = cohort > 0 ? (f.reached / cohort) * 100 : 0;
          const moves = standing.get(f.stage)?.moves ?? 0;
          return (
            <li key={f.stage} className="flex items-center gap-3">
              <span className="flex w-24 shrink-0 items-center gap-1.5">
                <span className={cn("size-1.5 shrink-0 rounded-full", meta.dot)} />
                <span className="truncate text-body text-text">{meta.label}</span>
              </span>
              <span className="block h-1.5 min-w-0 flex-1 rounded-full bg-surface-2">
                <span className="block h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
              </span>
              <span className="num w-10 shrink-0 text-right text-body text-text">
                {formatNumber(f.reached)}
              </span>
              <span className="num w-12 shrink-0 text-right text-small text-text-subtle">
                {Math.round(pct)}%
              </span>
              <span
                className={cn(
                  "num w-12 shrink-0 text-right text-small",
                  moves > 0 ? "text-green" : "text-text-subtle"
                )}
                title="ย้ายเข้าขั้นนี้ในช่วงที่เลือก"
              >
                {moves > 0 ? `+${moves}` : "—"}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-small text-text-subtle">
        คอลัมน์ขวาสุด = จำนวนที่ย้ายเข้าขั้นนั้นในช่วงนี้ · ระบบเริ่มเก็บประวัติการเปลี่ยนขั้นตอนเมื่อ 10 ก.ย. 2026
      </p>
    </>
  );
}
