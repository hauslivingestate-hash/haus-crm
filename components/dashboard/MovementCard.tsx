"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Check, LoaderCircle, Pencil, Target, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { formatNumber, formatDate } from "@/lib/format";
import { stageMeta } from "@/lib/pipeline";
import { ownerStageMeta } from "@/lib/ownerPipeline";
import { PERIOD_LABEL, type PeriodLength } from "@/lib/range";
import { actionMetric, ownerStageMetric, stageMetric, type WorkMetric } from "@/lib/workTargets";
import { drillKey, type DrillCase, type DrillTarget } from "@/lib/movementDrill";
import { fetchMovementCases } from "@/lib/mutations/movementDrill";
import { setWorkTargets } from "@/lib/mutations/targets";
import { useTopmostEscape } from "@/lib/overlayStack";
import type {
  ActivityTotal,
  FunnelStep,
  OwnerFunnelStep,
  StageMovement,
} from "@/lib/salesDashboard";

/* ความเคลื่อนไหว — what happened in the selected window, split into the two sides of
 * the business. Ported from Klaichan CRM's StageActivityCard.
 *
 * ── THE SPLIT COMES FROM THE DATA MODEL, not a list in this file ────────────────
 * `action_type.side` says which half an action belongs to. Not `group_label`, which is
 * free text meant for display, and not `attach`, which says which RECORD an action hangs
 * on — Sourcing hangs on nothing and is still property work. `side` is the closed set
 * this card can branch on, editable in ตั้งค่า, so the halves can never drift.
 *
 * ── BOTH HALVES HAVE TWO VIEWS, AND EACH IS KEYED TO ITS OWN PIPELINE ───────────
 * Actions and stage movement are different units, and only one of them is work a person
 * did. Five calls to a buyer parked at Follow is five actions and zero movement; dragging
 * one lead Lead → Call → Follow is two moves and maybe one call. Hence the toggles:
 *
 *   งานที่ทำ (default)  how many ACTIONS were logged at each step
 *   กรวยการขาย          how far the leads RECEIVED in this window actually got
 *
 * งานที่ทำ is the default because effort is the part a person controls.
 *
 * BOTH VIEWS ARE INDEXED BY THE SAME ROWS — same steps, same words, same colours — so
 * flipping between them compares like with like. That is only possible because
 * `action_type.stage_name` links an action to the step it advances. Klaichan matched the
 * two lists by label and had to migrate away from it; ours is a real FK, so renaming a
 * stage in ตั้งค่า carries every action with it.
 *
 * ── EACH TOGGLE STAYS INSIDE ITS OWN SECTION ────────────────────────────────────
 * Not in the card header. A header toggle swaps the whole body, so asking about buyer
 * conversion would delete the property half off the screen — which is exactly what the
 * first version of this file did.
 */

type View = "actions" | "funnel";

interface Row {
  key: string;
  label: string;
  n: number;
  /** Tailwind bg-* token for the leading dot. */
  dot: string;
  /** Dim second column when no target is showing — the funnel's conversion rate. */
  sub?: string;
  /** Period-over-period change. Occupies the same slot as the target percentage, so the
      two never show at once — see the note on Bar. */
  delta?: number | null;
  /** A third column, buyer funnel only: leads that moved INTO this step in the window. */
  moves?: number | null;
  subTitle?: string;
  /** Greys the row: a step with no action behind it can never score, which is a
      different fact from "nothing happened here". */
  muted?: boolean;
  /** The goal for this row over this range. Undefined means no goal, which draws
      differently from a goal of zero. */
  target?: number;
  /** What the editor writes back. Present on every settable row. */
  metric?: WorkMetric;
  /** Set when tapping the row can show which cases are behind the number. */
  drill?: DrillTarget;
}

export function MovementCard({
  activity,
  funnel,
  stages,
  ownerFunnel,
  newLeads,
  range,
  targets,
  standingTargets,
  canSetTargets,
  employeeCode,
  searchParams,
}: {
  activity: ActivityTotal[];
  funnel: FunnelStep[];
  /** Where leads stand right now — the context under the movement numbers. */
  stages: StageMovement[];
  ownerFunnel: OwnerFunnelStep[];
  /** Leads received in the window — the intake step's count. */
  newLeads: number;
  range: { label: string; period: PeriodLength; elapsed: number; compareLabel: string | null };
  /** metric → the figure THIS range is measured against. */
  targets: Record<WorkMetric, number>;
  /** metric → the unscaled standing figure, for the editor. */
  standingTargets: Record<WorkMetric, number>;
  canSetTargets: boolean;
  employeeCode: string;
  /** The same params the page resolved its range from, handed to the drill-down so its
      list can never describe a different window than the bar that opened it. */
  searchParams: { range?: string; from?: string; to?: string };
}) {
  const [ownerView, setOwnerView] = React.useState<View>("actions");
  const [buyerView, setBuyerView] = React.useState<View>("actions");
  const [drill, setDrill] = React.useState<{ target: DrillTarget; label: string } | null>(null);
  const [editing, setEditing] = React.useState(false);

  /* เป้า is OFF until the browser says otherwise, and the preference is read AFTER mount.
     Reading localStorage during render makes the server and client markup disagree, and a
     card that flickers its own numbers on load is worse than one that settles a frame
     late. Null = never chosen, which reads as "on if any goal exists" — somebody who has
     bothered to set goals should see them without hunting for a switch. */
  const [showTargets, setShowTargets] = React.useState(false);
  const hasAnyTarget = Object.keys(targets).length > 0;
  React.useEffect(() => {
    const pref = readTargetPref();
    setShowTargets(pref ?? hasAnyTarget);
  }, [hasAnyTarget]);
  const toggleTargets = (on: boolean) => {
    setShowTargets(on);
    writeTargetPref(on);
    if (!on) setEditing(false);
  };

  const goal = (metric: WorkMetric) => (showTargets ? targets[metric] : undefined);

  /* ---- ฝั่งเจ้าของ ----
     Ben, 2026-09-10: four steps, Sourcing → New List → Owner Talk → Owner Visit, and
     nothing else. Indexed by the OWNER pipeline exactly as the buyer half is indexed by
     the buyer one, so งานที่ทำ and กรวยเจ้าของ line up row for row.

     ⚠️ ทรัพย์ใหม่ IS GONE. It counted rows in the listings table, which disagrees with
     the logged action — 89 listings against 152 New List actions for S-004 in 2026. Ben
     removed it as a duplicate, so the New List bar now counts the ACTION: logging it
     twice for one unit counts twice, and creating a listing without logging it counts
     nothing. */

  const byOwnerStage = new Map<string, { n: number; prev: number | null; names: string[] }>();
  for (const a of activity) {
    if (!a.ownerStageName) continue;
    const slot = byOwnerStage.get(a.ownerStageName) ?? { n: 0, prev: null, names: [] };
    slot.n += a.total;
    if (a.prev != null) slot.prev = (slot.prev ?? 0) + a.prev;
    slot.names.push(a.action);
    byOwnerStage.set(a.ownerStageName, slot);
  }

  const ownerSteps = ownerFunnel.map((f) => f.stage);
  const ownerRows: Row[] = ownerSteps.map((stage) => {
    const meta = ownerStageMeta(stage);
    const slot = byOwnerStage.get(stage);
    const metric = ownerStageMetric(stage);
    return {
      key: stage,
      label: meta.label,
      n: slot?.n ?? 0,
      dot: meta.dot,
      delta: slot?.prev == null ? null : slot.n - slot.prev,
      metric,
      target: goal(metric),
      subTitle: slot
        ? `บันทึกจาก: ${slot.names.join(" · ")}`
        : "ยังไม่มีประเภทกิจกรรมที่ผูกกับขั้นนี้ — ตั้งได้ในตั้งค่า → ประเภทกิจกรรม",
      muted: !slot,
      drill: slot ? { of: "ownerStage" as const, stage, view: "actions" as const } : undefined,
    };
  });

  const ownerCohort = ownerFunnel[0]?.cohort ?? 0;
  const ownerFunnelRows: Row[] = ownerFunnel.map((f) => {
    const meta = ownerStageMeta(f.stage);
    return {
      key: f.stage,
      label: meta.label,
      n: f.reached,
      dot: meta.dot,
      // An em dash, not a blank: with no cohort there is no percentage to show, and an
      // empty cell in a numeric column reads as a value that failed to load.
      sub: ownerCohort > 0 ? `${Math.round((f.reached / ownerCohort) * 100)}%` : "—",
      subTitle: `${f.reached} จาก ${ownerCohort} ทรัพย์ที่รับเข้ามาใน${range.label} อยู่ที่ขั้นนี้หรือไกลกว่า`,
      drill: { of: "ownerStage" as const, stage: f.stage, view: "funnel" as const },
    };
  });
  const ownerTotal = ownerRows.reduce((s, r) => s + r.n, 0);

  /* ---- ฝั่งลูกค้า ---- */

  // stage → the actions that advance it. Several may point at one step (Close is fed by
  // both "Close" and "เซ็นสัญญา"), so they sum.
  const byStage = new Map<string, { n: number; prev: number | null; names: string[] }>();
  for (const a of activity) {
    if (!a.stageName) continue;
    const slot = byStage.get(a.stageName) ?? { n: 0, prev: null, names: [] };
    slot.n += a.total;
    if (a.prev != null) slot.prev = (slot.prev ?? 0) + a.prev;
    slot.names.push(a.action);
    byStage.set(a.stageName, slot);
  }

  // The funnel's step list is the spine of BOTH buyer views, so they line up row for row.
  const steps = funnel.map((f) => f.stage);
  const intake = steps[0];
  const movesByStage = new Map(stages.map((s) => [s.stage, s.moves]));

  const buyerActionRows: Row[] = steps.map((stage) => {
    const meta = stageMeta(stage);
    const isIntake = stage === intake;
    const slot = byStage.get(stage);
    const metric = stageMetric(stage);
    return {
      key: stage,
      label: meta.label,
      // The intake step counts ARRIVALS, not logged actions — a lead landing in the
      // system is the event, and asking somebody to also log "I received a lead" would
      // both double-count it and go undone.
      n: isIntake ? newLeads : slot?.n ?? 0,
      dot: meta.dot,
      delta: isIntake ? null : slot?.prev == null ? null : slot.n - slot.prev,
      metric,
      target: goal(metric),
      subTitle: isIntake
        ? "นับจากลีดที่รับเข้ามาใหม่ (ไม่ต้องบันทึกงานซ้ำ)"
        : slot
          ? `บันทึกจาก: ${slot.names.join(" · ")}`
          : "ยังไม่มีประเภทกิจกรรมที่ผูกกับขั้นนี้ — ตั้งได้ในตั้งค่า → ประเภทกิจกรรม",
      // A step with nothing pointing at it is structurally unscoreable, not merely zero.
      muted: !isIntake && !slot,
      drill: isIntake || slot ? { of: "stage" as const, stage, view: "actions" as const } : undefined,
    };
  });

  const cohort = funnel[0]?.cohort ?? 0;
  const buyerFunnelRows: Row[] = funnel.map((f) => {
    const meta = stageMeta(f.stage);
    const moves = movesByStage.get(f.stage) ?? 0;
    return {
      key: f.stage,
      label: meta.label,
      n: f.reached,
      dot: meta.dot,
      sub: cohort > 0 ? `${Math.round((f.reached / cohort) * 100)}%` : "—",
      moves,
      subTitle: `${f.reached} จาก ${cohort} ลีดที่รับเข้ามาใน${range.label} ไปถึงขั้นนี้`,
      drill: { of: "stage" as const, stage: f.stage, view: "funnel" as const },
    };
  });

  const buyerActionTotal = buyerActionRows.reduce((s, r) => s + r.n, 0);

  /* ---- งานอื่นๆ ----
     Ben, 2026-09-10: ประเมิน, ถ่ายรูป, Reels, ติดป้าย, โอน, Survey and Update Price
     "would not fall into both owner and buyer side but rather other activities.. and
     it's not pipeline but only action count type."

     So: real bars, not the footnote this used to be, and they can carry goals — they are
     countable work somebody is responsible for. What they do NOT get is a funnel toggle,
     because there is no order to them. Nothing converts into ถ่ายรูป. */
  const otherRows: Row[] = activity
    .filter((a) => a.side === "general")
    .map((a) => ({
      key: a.action,
      label: a.action,
      n: a.total,
      dot: "bg-text-subtle",
      delta: a.prev == null ? null : a.total - a.prev,
      metric: actionMetric(a.action),
      target: goal(actionMetric(a.action)),
      subTitle: `บันทึกไว้ในกลุ่ม ${a.group}`,
      drill: { of: "action" as const, name: a.action },
    }));
  const otherTotal = otherRows.reduce((s, r) => s + r.n, 0);

  /* MUTED ROWS ARE NOT SETTABLE. A stage with no action type pointing at it can never
     receive a logged action, so a goal on it could only ever read 0% — a number that
     would look like failure and mean "unreachable". The row still draws, greyed, so the
     gap is visible; it is fixed in ตั้งค่า, not by typing a target into it. */
  const settableRows = [...ownerRows, ...buyerActionRows, ...otherRows].filter(
    (r) => r.metric && !r.muted
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>ความเคลื่อนไหว · {range.label}</CardTitle>
        {/* THE เป้า SWITCH BELONGS TO THE WHOLE CARD, unlike the view toggles: both
            halves can carry goals, so a switch buried under one section would hide the
            other's — and flipping a view would take that section's goals away with it. */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => toggleTargets(!showTargets)}
            aria-pressed={showTargets}
            title={showTargets ? "ซ่อนเป้าหมาย" : "แสดงเป้าหมาย"}
            className={cn(
              "inline-flex h-6 items-center gap-1 rounded-md px-2 text-small transition-colors",
              showTargets ? "bg-accent-wash text-accent" : "bg-surface-2 text-text-muted hover:text-text"
            )}
          >
            <Target size={12} strokeWidth={2} /> เป้า
          </button>
          {showTargets && canSetTargets && (
            <button
              type="button"
              onClick={() => setEditing((e) => !e)}
              title="ตั้งเป้าจำนวนงานรายบรรทัด"
              aria-label="ตั้งเป้าจำนวนงาน"
              className="grid size-6 place-items-center rounded-md text-accent transition-colors hover:bg-accent-wash"
            >
              {editing ? <X size={13} strokeWidth={2} /> : <Pencil size={12} strokeWidth={2} />}
            </button>
          )}
          <Link
            href="/leads"
            className="inline-flex items-center gap-0.5 text-small font-medium text-accent transition-colors hover:text-accent-hover"
          >
            ดูทั้งหมด <ArrowUpRight size={13} strokeWidth={2} />
          </Link>
        </div>
      </CardHeader>

      <CardContent>
        {showTargets && editing && (
          <WorkTargetEditor
            /* Remounted when the period changes: the form seeds its inputs once, from the
               standing figures for THAT length, and a range switch while it is open would
               otherwise leave last period's numbers in the boxes ready to be saved. */
            key={range.period}
            rows={settableRows}
            standing={standingTargets}
            period={range.period}
            employeeCode={employeeCode}
            onDone={() => setEditing(false)}
          />
        )}

        {/* ================= ฝั่งเจ้าของ ================= */}
        <SectionHead
          title="ฝั่งเจ้าของ"
          hint={
            ownerView === "actions"
              ? `จำนวนงานที่บันทึกในแต่ละขั้นใน${range.label} — ต้นทางของทุกดีล`
              : `ทรัพย์ ${ownerCohort} รายการที่รับเข้ามาใน${range.label} · คุยกับเจ้าของไปถึงไหน`
          }
          view={ownerView}
          onView={setOwnerView}
          funnelLabel="กรวยเจ้าของ"
        />
        {ownerView === "actions" ? (
          <>
            <Bars rows={ownerRows} elapsed={range.elapsed} showTargets={showTargets} onDrill={setDrill} compareLabel={range.compareLabel} />
            {ownerTotal === 0 && <Quiet>ยังไม่มีงานฝั่งเจ้าของใน{range.label}</Quiet>}
          </>
        ) : (
          <>
            <Bars rows={ownerFunnelRows} elapsed={range.elapsed} showTargets={false} onDrill={setDrill} heads={["ถึงขั้นนี้", "% ของทั้งหมด"]} />
            {ownerCohort === 0 ? (
              <Quiet>ไม่มีทรัพย์ที่รับเข้ามาใน{range.label} — ลองขยายช่วงเวลาด้านบน</Quiet>
            ) : (
              <p className="mt-2.5 text-small text-text-subtle">
                อ่านจากขั้นปัจจุบันของทรัพย์ · ยังไม่มีประวัติการเปลี่ยนขั้นฝั่งเจ้าของ ทรัพย์ที่ถอยกลับจึงนับที่ขั้นปัจจุบัน
              </p>
            )}
          </>
        )}

        <div className="my-5 border-t border-border" />

        {/* ================= ฝั่งลูกค้า ================= */}
        <SectionHead
          title="ฝั่งลูกค้า"
          hint={
            buyerView === "actions"
              ? `จำนวนงานที่บันทึกในแต่ละขั้นใน${range.label} — งานที่ลงมือทำเอง`
              : `ลีด ${cohort} รายที่รับเข้ามาใน${range.label} · ไปได้ถึงขั้นไหน`
          }
          view={buyerView}
          onView={setBuyerView}
          funnelLabel="กรวยการขาย"
        />
        {buyerView === "actions" ? (
          <>
            <Bars rows={buyerActionRows} elapsed={range.elapsed} showTargets={showTargets} onDrill={setDrill} compareLabel={range.compareLabel} />
            {buyerActionTotal === 0 && (
              <Quiet>ยังไม่มีงานที่บันทึกกับลีดใน{range.label} — ติ๊กงานในแผนวันนี้แล้วระบบจะบันทึกให้เอง</Quiet>
            )}
          </>
        ) : (
          <>
            <Bars
              rows={buyerFunnelRows}
              elapsed={range.elapsed}
              showTargets={false}
              onDrill={setDrill}
              heads={["ถึงขั้นนี้", "% ของทั้งหมด", "เข้าขั้นนี้"]}
            />
            {cohort === 0 ? (
              <Quiet>ไม่มีลีดที่รับเข้ามาใน{range.label} — ลองขยายช่วงเวลาด้านบน</Quiet>
            ) : (
            <p className="mt-2.5 text-small text-text-subtle">
              นับเฉพาะลีดที่ <b>รับเข้ามาในช่วงนี้</b> จึงเทียบเป็นเปอร์เซ็นต์ได้ · ลีดที่ถอยกลับยังนับว่าเคยไปถึงขั้นที่ไกลที่สุดแล้ว ·
              คอลัมน์ขวาสุดคือจำนวนที่ย้ายเข้าขั้นนั้นในช่วงนี้ (เริ่มเก็บ 10 ก.ย. 2026)
            </p>
            )}
          </>
        )}

        {otherRows.length > 0 && (
          <>
            <div className="my-5 border-t border-border" />

            {/* ================= งานอื่นๆ ================= */}
            {/* No toggle: there is no pipeline here to switch to. The heading says so, or
                a low number would read as a stalled funnel. */}
            <div className="mb-3">
              <h3 className="text-body font-medium text-text">งานอื่นๆ</h3>
              <p className="mt-0.5 text-small leading-snug text-text-subtle">
                งานที่นับจำนวนอย่างเดียว ไม่ได้อยู่ในไปป์ไลน์ฝั่งไหน — ตั้งเป้าได้เหมือนกัน
              </p>
            </div>
            <Bars
              rows={otherRows}
              elapsed={range.elapsed}
              showTargets={showTargets}
              onDrill={setDrill}
              compareLabel={range.compareLabel}
            />
            {otherTotal === 0 && <Quiet>ยังไม่มีงานกลุ่มนี้ใน{range.label}</Quiet>}
          </>
        )}
      </CardContent>

      {drill && (
        <DrillModal
          target={drill.target}
          label={drill.label}
          rangeLabel={range.label}
          searchParams={searchParams}
          onClose={() => setDrill(null)}
        />
      )}
    </Card>
  );
}

/* ---------- the เป้า preference ---------------------------------------------------
   Remembered per browser, not per account: which of the two numbers somebody wants to
   see is a reading preference that changes with the question they are asking, and
   round-tripping it through the server would make a toggle feel like a save. Wrapped
   because localStorage throws outright in a few contexts (private windows, blocked site
   data) rather than returning null. */

const TARGET_PREF_KEY = "haus.dashboard.workTargets";

function readTargetPref(): boolean | null {
  try {
    const raw = window.localStorage.getItem(TARGET_PREF_KEY);
    return raw === null ? null : raw === "1";
  } catch {
    return null;
  }
}

function writeTargetPref(on: boolean) {
  try {
    window.localStorage.setItem(TARGET_PREF_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/* ---------- pieces --------------------------------------------------------------- */

function SectionHead({
  title,
  hint,
  view,
  onView,
  funnelLabel,
}: {
  title: string;
  hint: string;
  view: View;
  onView: (v: View) => void;
  funnelLabel: string;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-body font-medium text-text">{title}</h3>
        <p className="mt-0.5 text-small leading-snug text-text-subtle">{hint}</p>
      </div>
      <div className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-surface-2 p-0.5">
        {([["actions", "งานที่ทำ"], ["funnel", funnelLabel]] as const).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => onView(k)}
            aria-pressed={view === k}
            className={cn(
              "h-6 whitespace-nowrap rounded-[6px] px-2.5 text-small transition-colors",
              view === k ? "bg-surface text-text shadow-card" : "text-text-muted hover:text-text"
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* A NOTE UNDER THE ROWS, NOT INSTEAD OF THEM.
   This used to replace the whole section when its total was zero, which is exactly
   backwards: the steps are a fixed spine, and a quiet month is when somebody most needs
   to see WHICH of them is empty. Removing the rows also took the goals with them — a
   target set on Show would vanish on the one range where it was being missed. So the
   bars always draw, and this explains the emptiness beneath them. */
function Quiet({ children }: { children: React.ReactNode }) {
  return <p className="mt-2.5 text-small text-text-subtle">{children}</p>;
}

function Bars({
  rows,
  elapsed,
  showTargets,
  onDrill,
  heads,
  compareLabel,
}: {
  rows: Row[];
  elapsed: number;
  showTargets: boolean;
  onDrill: (d: { target: DrillTarget; label: string }) => void;
  heads?: [string, string] | [string, string, string];
  compareLabel?: string | null;
}) {
  const max = rows.reduce((m, r) => Math.max(m, r.n), 0) || 1;
  // The second column carries ONE meaning at a time. With goals showing it is progress
  // toward the goal; without, it is the change against the previous equivalent window.
  // Mixing them would put two unrelated percentages under one heading.
  const columns: [string, string] | [string, string, string] =
    heads ?? (showTargets ? ["จำนวน", "% ของเป้า"] : ["จำนวน", compareLabel ?? ""]);

  return (
    <div>
      <ColumnHeads heads={columns} />
      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <Bar key={r.key} row={r} max={max} elapsed={elapsed} wide={columns.length === 3} onDrill={onDrill} />
        ))}
      </div>
    </div>
  );
}

function ColumnHeads({ heads }: { heads: [string, string] | [string, string, string] }) {
  return (
    <div className="mb-1.5 flex items-center gap-2.5 text-label uppercase tracking-wide text-text-subtle">
      <span className="w-24 shrink-0" />
      <span className="min-w-0 flex-1" />
      <span className="w-10 shrink-0 text-right">{heads[0]}</span>
      <span className="w-16 shrink-0 truncate text-right">{heads[1]}</span>
      {heads.length === 3 && <span className="w-12 shrink-0 text-right">{heads[2]}</span>}
      <span className="w-3 shrink-0" />
    </div>
  );
}

/** One row: dot · label · track · count · second column · (third) · chevron.
 *
 *  EVERY NUMBER SITS OUTSIDE THE TRACK, in fixed-width right-hand columns. Inside the
 *  fill, a zero-count row shows no number at all (an empty bar reads as "no data" rather
 *  than "nothing happened") and the figures shift with each bar's length, so a column
 *  cannot be scanned. Outside and right-aligned they line up down the whole card — which
 *  is also why they wear `.num`, tabular figures being for columns. */
function Bar({
  row,
  max,
  elapsed,
  wide,
  onDrill,
}: {
  row: Row;
  max: number;
  elapsed: number;
  wide: boolean;
  onDrill: (d: { target: DrillTarget; label: string }) => void;
}) {
  /* WITH A GOAL the track means something different, and says so: the fill is progress
     toward the goal rather than a share of the biggest row, and the second column becomes
     the percentage. Without one it stays the comparison chart it was. The two never mix
     inside one section, or the widths would not be comparable. */
  const hasTarget = row.target != null && row.target > 0;
  const pct = hasTarget ? (row.n / (row.target as number)) * 100 : 0;
  const met = hasTarget && pct >= 100;
  const width = hasTarget ? Math.min(100, pct) : (row.n / max) * 100;

  /* THE PACE MARKER — the same fact เป้ารายได้ carries, for the same reason: a bar
     without it is unreadable mid-period. 40% of a monthly goal on the 9th is ahead; on
     the 27th it is a crisis; a bare fill draws both identically. It sits ON the track
     rather than inside the fill so it stays visible whether the work has passed it or
     not, and only appears with a goal and an unfinished period — a tick on a
     share-of-max comparison would mark nothing. */
  const showPace = hasTarget && elapsed < 1;
  const behind = hasTarget && elapsed < 1 && pct < elapsed * 100;

  const second = hasTarget
    ? `${Math.round(pct)}%`
    : row.sub ??
      (row.delta == null ? "" : row.delta === 0 ? "±0" : row.delta > 0 ? `+${row.delta}` : `${row.delta}`);

  const secondTone = hasTarget
    ? met
      ? "font-semibold text-green"
      : behind
        ? "font-semibold text-amber"
        : "text-text-subtle"
    : row.sub != null || row.delta == null || row.delta === 0
      ? "text-text-subtle"
      : row.delta > 0
        ? "text-green"
        : "text-red";

  const title = hasTarget
    ? `${row.subTitle ?? row.label} · เป้า ${row.target}${
        showPace ? ` · ผ่านมาแล้ว ${Math.round(elapsed * 100)}% ของช่วงเวลา` : ""
      }`
    : row.subTitle;

  const body = (
    <>
      <span className="flex w-24 shrink-0 items-center gap-1.5">
        <span className={cn("size-1.5 shrink-0 rounded-full", row.dot)} />
        <span className="truncate text-body text-text">{row.label}</span>
      </span>
      {/* `relative` and NOT clipped, so the pace tick can sit on top of the track; the
          fill keeps its own rounding rather than relying on the parent to clip it. */}
      <span className="relative block h-2 min-w-0 flex-1 rounded-full bg-surface-2">
        {row.n > 0 && (
          <span
            // A 2px floor, not a percentage minimum: with the count outside, the fill no
            // longer has to be wide enough to hold text, so one-out-of-forty reads as the
            // sliver it honestly is.
            className={cn("block h-full rounded-full transition-[width] duration-500", met ? "bg-green" : "bg-accent")}
            style={{ width: `max(${width}%, 2px)` }}
          />
        )}
        {showPace && (
          <span
            aria-hidden
            className="absolute top-0 h-full w-0.5 rounded-full bg-text-muted"
            style={{ left: `${elapsed * 100}%` }}
          />
        )}
      </span>
      <span className={cn("num w-10 shrink-0 text-right text-body", row.n > 0 ? "text-text" : "text-text-subtle")}>
        {row.n > 0 ? formatNumber(row.n) : "–"}
      </span>
      <span className={cn("num w-16 shrink-0 text-right text-small", secondTone)}>{second}</span>
      {wide && (
        <span
          className={cn("num w-12 shrink-0 text-right text-small", row.moves ? "text-green" : "text-text-subtle")}
          title="ย้ายเข้าขั้นนี้ในช่วงที่เลือก"
        >
          {row.moves ? `+${row.moves}` : "—"}
        </span>
      )}
      {/* Only rendered when the row opens something, so a chevron never promises a tap
          that does nothing. */}
      <ArrowUpRight
        size={12}
        strokeWidth={2}
        className={cn("shrink-0 text-text-subtle transition-opacity", row.drill ? "opacity-0 group-hover:opacity-100" : "invisible")}
      />
    </>
  );

  if (!row.drill) {
    return (
      <div className={cn("flex items-center gap-2.5", row.muted && "opacity-45")} title={title}>
        {body}
      </div>
    );
  }
  const drill = row.drill;
  return (
    <button
      type="button"
      onClick={() => onDrill({ target: drill, label: row.label })}
      title={`${title ?? row.label} — กดเพื่อดูว่ามีรายการไหนบ้าง`}
      className={cn(
        "group -mx-1 flex items-center gap-2.5 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-surface-hover",
        row.muted && "opacity-45"
      )}
    >
      {body}
    </button>
  );
}

/* ---------- which cases are behind one bar --------------------------------------- */

/** Loaded on open — see lib/movementDrill.ts for why this is not shipped with the page.
 *
 *  Every row is a LINK into the record, because the question this answers ("มีรายการไหน
 *  บ้าง") is almost always followed by "แล้วต้องทำอะไรต่อ". It is also where a
 *  mis-logged entry gets caught, which is why the action and the remark are both shown
 *  rather than a bare list of names. */
function DrillModal({
  target,
  label,
  rangeLabel,
  searchParams,
  onClose,
}: {
  target: DrillTarget;
  label: string;
  rangeLabel: string;
  searchParams: { range?: string; from?: string; to?: string };
  onClose: () => void;
}) {
  const [rows, setRows] = React.useState<DrillCase[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  useTopmostEscape(onClose);

  const key = drillKey(target);
  React.useEffect(() => {
    let alive = true;
    setRows(null);
    setError(null);
    fetchMovementCases(searchParams, target)
      .then((r) => alive && setRows(r))
      .catch(() => alive && setError("โหลดรายการไม่สำเร็จ"));
    return () => {
      alive = false;
    };
    // The target object is rebuilt on every render, so it is keyed by its string rather
    // than compared by reference — otherwise this refetches on every state change
    // anywhere in the card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, searchParams.range, searchParams.from, searchParams.to]);

  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        className="flex max-h-[85vh] w-full flex-col gap-3 rounded-t-xl border border-border bg-surface p-5 shadow-pop sm:max-w-md sm:rounded-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-h2 truncate">
              {label} · {rangeLabel}
            </div>
            <p className="mt-0.5 text-small text-text-muted">
              {target.of === "ownerStage" && target.view === "funnel"
                ? "ทรัพย์ที่รับเข้ามาในช่วงนี้และอยู่ขั้นนี้หรือไกลกว่า"
                : target.of === "stage" && target.view === "funnel"
                  ? "ลีดที่รับเข้ามาในช่วงนี้และไปถึงขั้นนี้แล้ว"
                  : "งานที่บันทึกไว้ — กดที่ชื่อเพื่อเปิดรายละเอียด"}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="ปิด"
            className="grid size-8 shrink-0 place-items-center rounded-md text-text-subtle transition-colors hover:bg-surface-hover hover:text-text"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        {error && <p className="rounded-md bg-red-bg px-3 py-2 text-small text-red">{error}</p>}
        {!rows && !error && (
          <p className="flex items-center gap-2 py-6 text-small text-text-subtle">
            <LoaderCircle size={14} className="animate-spin" /> กำลังโหลด…
          </p>
        )}
        {rows && rows.length === 0 && (
          <p className="rounded-md bg-surface-2 px-3 py-2.5 text-small text-text-muted">
            ยังไม่มีรายการในช่วงนี้
          </p>
        )}
        {rows && rows.length > 0 && (
          <ul className="flex flex-col divide-y divide-border overflow-y-auto">
            {rows.map((c, i) => (
              <li key={`${c.side}-${c.id}-${i}`} className="py-2">
                <div className="flex items-baseline gap-2">
                  {c.id ? (
                    <Link
                      href={c.side === "lead" ? `/leads/${c.id}` : `/listings/${c.id}`}
                      className="min-w-0 flex-1 truncate text-body font-medium text-text transition-colors hover:text-accent hover:underline"
                    >
                      {c.name}
                    </Link>
                  ) : (
                    <span className="min-w-0 flex-1 truncate text-body text-text-muted">{c.name}</span>
                  )}
                  <span className="num shrink-0 text-label text-text-subtle">{formatDate(c.date)}</span>
                </div>
                {/* `detail` means a different thing per target, so each is rendered
                    through its own branch — a stage key printed bare would read as a bug. */}
                <div className="mt-0.5 flex items-baseline gap-1.5">
                  {c.kind && <span className="shrink-0 text-label font-medium text-text-muted">{c.kind}</span>}
                  {c.detail && (
                    <span className="min-w-0 flex-1 truncate text-small text-text-subtle">
                      {c.kind ? c.detail : `ขั้น ${c.detail}`}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ---------- the goal editor ------------------------------------------------------ */

/** ONE FORM FOR THE WHOLE CARD — every settable row from both halves, each carrying the
 *  metric it is scored against, so the form never has to know which namespace a line
 *  belongs to.
 *
 *  The period is whatever the range bar is showing, and the heading says which: "10"
 *  means a very different thing per day than per quarter, and a form that did not say
 *  would be unusable. */
function WorkTargetEditor({
  rows,
  standing,
  period,
  employeeCode,
  onDone,
}: {
  rows: Row[];
  /** Unscaled standing figures for this period, keyed by metric. */
  standing: Record<WorkMetric, number>;
  period: PeriodLength;
  employeeCode: string;
  onDone: () => void;
}) {
  const [values, setValues] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(
      rows.map((r) => [r.metric as string, standing[r.metric as string] ? String(standing[r.metric as string]) : ""])
    )
  );
  const [pending, start] = React.useTransition();
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const busy = pending || saving;

  const save = async () => {
    setError(null);
    setSaving(true);
    // Every row the form showed is sent, so a box cleared to blank becomes 0 and 0
    // deletes the row — "no goal" has to be reachable without an escape hatch of its own.
    const parsed = Object.fromEntries(
      rows.map((r) => [
        r.metric as string,
        Math.max(0, Math.round(Number((values[r.metric as string] ?? "").replace(/,/g, "")) || 0)),
      ])
    );
    try {
      const res = await setWorkTargets(employeeCode, period, parsed);
      if (!res.ok) setError(res.error);
      else start(() => onDone());
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-4 rounded-md bg-surface-2 p-3">
      <p className="mb-2.5 text-small text-text-muted">
        ตั้งเป้าจำนวนงาน <b>{PERIOD_LABEL[period]}</b> ของแต่ละบรรทัด · เว้นว่างหรือใส่ 0 เพื่อไม่ตั้งเป้าบรรทัดนั้น
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {rows.map((r) => (
          <label key={r.key} className="flex items-center gap-2">
            <span className={cn("size-1.5 shrink-0 rounded-full", r.dot)} />
            <span className="w-20 shrink-0 truncate text-small text-text-muted">{r.label}</span>
            <input
              inputMode="numeric"
              value={values[r.metric as string] ?? ""}
              onChange={(e) =>
                setValues((v) => ({ ...v, [r.metric as string]: e.target.value.replace(/[^\d]/g, "") }))
              }
              placeholder="0"
              className="num h-8 min-w-0 flex-1 rounded-md border border-border-strong bg-surface px-2 text-body outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </label>
        ))}
      </div>
      {error && <p className="mt-2 text-small text-red">{error}</p>}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md bg-accent text-body font-medium text-text-onaccent transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {busy ? <LoaderCircle size={13} className="animate-spin" /> : <Check size={14} strokeWidth={2} />} บันทึกเป้าหมาย
        </button>
        <button
          type="button"
          onClick={onDone}
          disabled={busy}
          className="h-9 rounded-md px-3 text-small text-text-subtle transition-colors hover:text-text disabled:opacity-50"
        >
          ยกเลิก
        </button>
      </div>
    </div>
  );
}
