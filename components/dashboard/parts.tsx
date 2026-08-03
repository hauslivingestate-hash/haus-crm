"use client";

import * as React from "react";
import { Avatar } from "@/components/ui/Avatar";
import { C, R, FONT_MONO, heatCell, delta } from "@/components/dashboard/theme";
import {
  DASH_DAY,
  DASH_DAYS_IN_MONTH,
  DASH_AGENTS,
  KPI_DEFS,
  kpiValue,
  isFocusWeek,
  agentKpi,
  heatValue,
  HEATMAP_CATEGORIES,
  type DashAgent,
  type AgentKpi,
  type KpiDef,
  type HeatCategory,
} from "@/lib/dashboard";

// Full baht with thousands separators (฿7,800,000) — matches the HAUS V2 dashboard, which
// never abbreviates revenue/commission to "ล้าน". Rounded (avg-ticket division can be fractional).
export const fmtTHB = (n: number | null | undefined) => `฿${Math.round(n ?? 0).toLocaleString("en-US")}`;
const pad2 = (n: number) => String(n).padStart(2, "0");

// ── primitives ───────────────────────────────────────────────────────────────
export function DashCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  // minWidth:0 lets the card shrink inside flex/grid parents so inner overflow-x
  // scroll containers (e.g. the heatmap) clip instead of pushing the page wide.
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: R.lg, padding: 22, minWidth: 0, ...style }}>
      {children}
    </div>
  );
}

/** Small in-card header: // eyebrow + title + optional hint. */
export function CardHead({ eyebrow, title, hint }: { eyebrow: string; title: string; hint?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ color: C.muted, fontSize: 12, marginBottom: 4 }}>// {eyebrow}</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: C.ink }}>{title}</div>
      {hint && <div style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

export function Eyebrow({ children, color = C.muted }: { children: React.ReactNode; color?: string }) {
  return (
    <div className="num" style={{ fontSize: 11, color, letterSpacing: "0.1em", textTransform: "uppercase" }}>
      {children}
    </div>
  );
}

export function DeltaText({ pct, label }: { pct: number | null; label?: string }) {
  if (pct == null || pct === 0) return label ? <span style={{ color: C.muted, fontSize: 13 }}>{label}</span> : null;
  const up = pct > 0;
  return (
    <span style={{ fontSize: 13 }}>
      <span className="num" style={{ color: up ? C.pos : C.neg, fontWeight: 600 }}>
        {up ? "↑" : "↓"} {Math.abs(pct)}%
      </span>
      {label && <span style={{ color: C.muted }}> {label}</span>}
    </span>
  );
}

/** Editorial section header — mono counter + // eyebrow + big display title. */
export function SectionHead({
  index,
  total,
  eyebrow,
  title,
  subtitle,
  avatar,
  right,
}: {
  index: number;
  total: number;
  eyebrow: string;
  title: string;
  subtitle?: string;
  avatar?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div className="num" style={{ fontSize: 10, color: C.muted, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 12 }}>
        [ {pad2(index)} / {pad2(total)} ]
      </div>
      <div style={{ color: C.inkSoft, fontSize: 14, marginBottom: 6 }}>// {eyebrow}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {avatar}
          <h2 className="dash-title" style={{ fontWeight: 600, margin: 0, color: C.ink, lineHeight: 1.02, letterSpacing: "-0.015em" }}>
            {title}
          </h2>
        </div>
        {right}
      </div>
      {subtitle && <p style={{ color: C.inkSoft, marginTop: 12, maxWidth: 640, fontSize: 14 }}>{subtitle}</p>}
    </div>
  );
}

/** Gold-ringed avatar for #1. */
const AV_SIZE: Record<number, string> = { 20: "h-5 w-5", 24: "h-6 w-6", 28: "h-7 w-7", 40: "h-10 w-10 text-small" };
function RankAvatar({ agent, gold, size = 24 }: { agent: string; gold?: boolean; size?: number }) {
  return (
    <span style={{ display: "inline-flex", borderRadius: R.pill, boxShadow: gold ? `0 0 0 2px ${C.gold}` : "none" }}>
      <Avatar name={agent} tone={gold ? "crimson" : "neutral"} className={AV_SIZE[size] ?? "h-6 w-6"} />
    </span>
  );
}

// ── Recognition spotlight (champagne) ────────────────────────────────────────
export function Recognition({ name, note, value, units }: { name: string; note: string; value: number; units: number }) {
  return (
    <div
      style={{
        background: C.goldSoft,
        border: `1px solid ${C.goldFaint}`,
        borderRadius: R.lg,
        padding: "16px 22px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <RankAvatar agent={name} gold size={40} />
      <div style={{ flex: 1, minWidth: 160 }}>
        <div className="num" style={{ color: C.gold, fontSize: 11, letterSpacing: "0.08em", marginBottom: 2 }}>★ สุดยอดนักขาย</div>
        <div style={{ fontSize: 18, fontWeight: 600, color: C.ink }}>{name}</div>
        <div style={{ color: C.muted, fontSize: 12 }}>{note}</div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Chip icon="🏆">{fmtTHB(value)}</Chip>
        <Chip>{units} ยูนิต</Chip>
      </div>
    </div>
  );
}
function Chip({ children, icon }: { children: React.ReactNode; icon?: string }) {
  return (
    <span
      className="num"
      style={{ background: C.card, border: `1px solid ${C.goldFaint}`, borderRadius: R.md, padding: "5px 10px", fontSize: 12, color: C.ink, whiteSpace: "nowrap", fontWeight: 600 }}
    >
      {icon ? `${icon} ` : ""}
      {children}
    </span>
  );
}

// ── Hero progress (revenue vs goal + MTD pace) ───────────────────────────────
export function HeroProgress({
  label,
  current,
  previous,
  units,
  unitsPrev,
  goal,
  showPace = true,
}: {
  label: string;
  current: number;
  previous: number;
  units: number;
  unitsPrev: number;
  goal: number;
  showPace?: boolean;
}) {
  const pct = goal > 0 ? Math.min(100, Math.round((current / goal) * 100)) : 0;
  const ticket = units > 0 ? current / units : null;
  const ticketPrev = unitsPrev > 0 ? previous / unitsPrev : null;
  const projected = showPace ? Math.round(current * (DASH_DAYS_IN_MONTH / DASH_DAY)) : 0;
  const onPace = projected >= goal;
  const todayPct = (DASH_DAY / DASH_DAYS_IN_MONTH) * 100;

  return (
    <DashCard>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 28, flexWrap: "wrap" }}>
          <div>
            <Eyebrow>{label}</Eyebrow>
            <div className="num" style={{ fontSize: 52, fontWeight: 600, color: C.ink, lineHeight: 1, letterSpacing: "-0.02em", marginTop: 8 }}>
              {fmtTHB(current)}
            </div>
            <div style={{ marginTop: 12, display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <DeltaText pct={delta(current, previous)} label={showPace ? "vs เดือนก่อน" : "vs ช่วงก่อน"} />
              {showPace && <span style={{ color: C.border }}>·</span>}
              {showPace && (
                <span style={{ color: onPace ? C.pos : C.neg, fontSize: 13, fontWeight: 500 }}>คาดสิ้นเดือน {fmtTHB(projected)}</span>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 40 }}>
            <SecondaryStat label="ยูนิตที่ปิด" value={units > 0 ? String(units) : "–"} pct={delta(units, unitsPrev)} />
            <SecondaryStat label="มูลค่าเฉลี่ย/ยูนิต" value={ticket != null ? fmtTHB(ticket) : "–"} pct={ticket != null && ticketPrev != null ? delta(ticket, ticketPrev) : null} />
          </div>
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.muted, marginBottom: 6 }}>
            <span>เป้า · {fmtTHB(goal)}</span>
            <span className="num" style={{ color: C.ink, fontWeight: 600 }}>{pct}%</span>
          </div>
          <div style={{ position: "relative", height: 10, background: C.borderSoft, borderRadius: R.sm, overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, width: `${pct}%`, background: C.accent, borderRadius: R.sm, transition: "width 400ms ease" }} />
            {showPace && <div style={{ position: "absolute", top: -2, bottom: -2, left: `${todayPct}%`, width: 2, background: C.ink, opacity: 0.55 }} title="วันนี้" />}
          </div>
          {showPace && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.muted, marginTop: 6 }}>
              <span className="num">วันที่ {DASH_DAY}/{DASH_DAYS_IN_MONTH}</span>
              <span>{onPace ? "ทันเป้า" : "ช้ากว่าเป้า"}</span>
            </div>
          )}
        </div>
      </div>
    </DashCard>
  );
}

function SecondaryStat({ label, value, pct }: { label: string; value: string; pct: number | null }) {
  return (
    <div style={{ minWidth: 96 }}>
      <Eyebrow>{label}</Eyebrow>
      <div className="num" style={{ fontSize: 24, fontWeight: 600, color: C.ink, lineHeight: 1, marginTop: 8 }}>{value}</div>
      <div style={{ marginTop: 8, minHeight: 16 }}>
        <DeltaText pct={pct} label="vs ก่อน" />
      </div>
    </div>
  );
}

// ── Revenue leaderboard ──────────────────────────────────────────────────────
export function RevenueLeaderboard({ rows }: { rows: { agent: string; revenue: number }[] }) {
  const max = Math.max(...rows.map((r) => r.revenue), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {rows.map((r, i) => (
        <div key={r.agent} style={{ display: "grid", gridTemplateColumns: "18px 28px 1fr auto", alignItems: "center", gap: 10 }}>
          <div className="num" style={{ fontSize: 11, color: C.muted }}>{pad2(i + 1)}</div>
          <RankAvatar agent={r.agent} gold={i === 0} size={28} />
          <div>
            <div style={{ fontSize: 13, color: C.ink, fontWeight: 500, marginBottom: 4 }}>{r.agent}</div>
            <div style={{ position: "relative", height: 6, background: C.borderSoft, borderRadius: R.sm, overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, width: `${(r.revenue / max) * 100}%`, background: i === 0 ? C.gold : C.accent, borderRadius: R.sm }} />
            </div>
          </div>
          <div className="num" style={{ fontSize: 12, color: C.ink, fontWeight: 600, minWidth: 70, textAlign: "right" }}>{fmtTHB(r.revenue)}</div>
        </div>
      ))}
    </div>
  );
}

// ── Team KPI tracker ─────────────────────────────────────────────────────────
export function TeamKpiTracker() {
  const kpis = React.useMemo(() => DASH_AGENTS.map((a) => agentKpi(a)), []);
  return (
    <DashCard>
      <div style={{ marginBottom: 16 }}>
        <div style={{ color: C.muted, fontSize: 12 }}>// KPI ทีมขาย</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: C.ink }}>ผลงานตามกระบวนการขาย</div>
        <div style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>จังหวะโฟกัสรายสัปดาห์ของแต่ละเอเจนต์ · นับสะสมทั้งเดือน</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 20 }}>
        {KPI_DEFS.map((def) => (
          <KpiColumn key={def.id} def={def} kpis={kpis} />
        ))}
      </div>
    </DashCard>
  );
}

function KpiColumn({ def, kpis }: { def: KpiDef; kpis: AgentKpi[] }) {
  const focus = isFocusWeek(def);
  const rows = kpis.map((k) => ({ agent: k.agent, ...kpiValue(k, def) })).sort((a, b) => b.pct - a.pct);
  return (
    <div style={{ borderLeft: `2px solid ${focus ? C.accent : "transparent"}`, paddingLeft: focus ? 12 : 0 }}>
      <div style={{ marginBottom: 12 }}>
        <div className="num" style={{ fontSize: 10, color: focus ? C.accent : C.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 2, display: "flex", alignItems: "center", gap: 6 }}>
          {focus && <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.accent }} />}
          {def.focusLabel}
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{def.label}</div>
        <div className="num" style={{ fontSize: 10, color: C.muted, letterSpacing: "0.06em", marginTop: 2 }}>
          {def.format === "count" ? `เป้า ${rows[0]?.denom ?? ""}` : "เป้า 100%"}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((r, i) => {
          const lead = i === 0 && r.pct > 0;
          return (
            <div key={r.agent} style={{ display: "grid", gridTemplateColumns: "20px 1fr 48px", gap: 8, alignItems: "center" }}>
              <RankAvatar agent={r.agent} gold={lead && focus} size={20} />
              <div>
                <div style={{ fontSize: 11, color: C.inkSoft, fontWeight: lead ? 600 : 400, marginBottom: 2 }}>{r.agent}</div>
                <div style={{ position: "relative", height: 6, background: C.borderSoft, borderRadius: R.sm, overflow: "hidden" }}>
                  <div style={{ position: "absolute", inset: 0, width: `${r.pct}%`, background: focus ? C.accent : C.accentLight, borderRadius: R.sm, opacity: r.pct === 0 ? 0 : 1 }} />
                </div>
              </div>
              <div className="num" style={{ fontSize: 11, textAlign: "right", color: lead && focus ? C.accent : C.ink, fontWeight: lead ? 600 : 400 }}>{r.text}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Agent KPI rows (single agent) ────────────────────────────────────────────
export function AgentKpiRows({ agent }: { agent: DashAgent }) {
  const k = agentKpi(agent);
  return (
    <DashCard>
      <div style={{ marginBottom: 16 }}>
        <div style={{ color: C.muted, fontSize: 12 }}>// KPI</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: C.ink }}>ผลงานตามกระบวนการขาย</div>
        <div style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>จังหวะโฟกัสรายสัปดาห์ · นับสะสมทั้งเดือน</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {KPI_DEFS.map((def) => {
          const v = kpiValue(k, def);
          const focus = isFocusWeek(def);
          return (
            <div key={def.id} style={{ display: "grid", gridTemplateColumns: "150px 1fr 56px", gap: 12, alignItems: "center", borderLeft: `2px solid ${focus ? C.accent : "transparent"}`, paddingLeft: focus ? 10 : 0 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {focus && <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.accent }} />}
                  <span style={{ fontSize: 13, color: C.ink, fontWeight: focus ? 600 : 500 }}>{def.label}</span>
                </div>
                <div className="num" style={{ fontSize: 10, color: focus ? C.accent : C.muted, marginTop: 2 }}>
                  {def.focusLabel} · {def.format === "count" ? `เป้า ${v.denom}` : `${v.done}/${v.denom}`}
                </div>
              </div>
              <div style={{ position: "relative", height: 8, background: C.borderSoft, borderRadius: R.sm, overflow: "hidden" }}>
                <div style={{ position: "absolute", inset: 0, width: `${v.pct}%`, background: focus ? C.accent : C.accentLight, borderRadius: R.sm, opacity: v.pct === 0 ? 0 : 1 }} />
              </div>
              <div className="num" style={{ fontSize: 12, textAlign: "right", color: focus ? C.accent : C.ink, fontWeight: 600 }}>{v.text}</div>
            </div>
          );
        })}
      </div>
    </DashCard>
  );
}

// ── Action breakdown ─────────────────────────────────────────────────────────
export function ActionBreakdownCard({
  eyebrow,
  title,
  hint,
  items,
  highlightKey,
}: {
  eyebrow: string;
  title: string;
  hint?: string;
  items: { key: string; label: string; count: number }[];
  highlightKey?: string;
}) {
  const max = Math.max(1, ...items.map((b) => b.count));
  return (
    <DashCard>
      <div style={{ color: C.muted, fontSize: 12, marginBottom: 4 }}>{eyebrow}</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: C.ink }}>{title}</div>
      {hint && <div style={{ color: C.muted, fontSize: 12, marginTop: 4, marginBottom: 16 }}>{hint}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: hint ? 0 : 16 }}>
        {items.map((b) => (
          <div key={b.key} style={{ display: "grid", gridTemplateColumns: "120px 1fr 40px", gap: 8, alignItems: "center" }}>
            <div style={{ fontSize: 12, color: C.inkSoft, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{b.label}</div>
            <div style={{ position: "relative", height: 16, background: C.borderSoft, borderRadius: R.sm }}>
              <div style={{ position: "absolute", inset: 0, width: `${(b.count / max) * 100}%`, background: b.key === highlightKey ? C.accentLight : C.accent, borderRadius: R.sm }} />
            </div>
            <div className="num" style={{ fontSize: 12, textAlign: "right", color: C.ink }}>{b.count}</div>
          </div>
        ))}
      </div>
    </DashCard>
  );
}

// ── Team heatmap (green, day × agent) ────────────────────────────────────────
export function TeamHeatmap() {
  const [cat, setCat] = React.useState<HeatCategory>("all");

  const { order, totals, rows, maxCell } = React.useMemo(() => {
    const totals = DASH_AGENTS.map((a) => {
      let t = 0;
      for (let d = 1; d <= DASH_DAYS_IN_MONTH; d++) t += heatValue(a, d, cat);
      return t;
    });
    const ord = totals.map((t, i) => ({ t, i })).sort((a, b) => b.t - a.t).map((x) => x.i);
    const agents = ord.map((i) => DASH_AGENTS[i]);
    const dayRows = [];
    for (let d = 1; d <= DASH_DAYS_IN_MONTH; d++) dayRows.push({ day: d, counts: agents.map((a) => heatValue(a, d, cat)) });
    const mx = Math.max(1, ...dayRows.flatMap((r) => r.counts));
    return { order: agents, totals: ord.map((i) => totals[i]), rows: dayRows, maxCell: mx };
  }, [cat]);

  const cols = `36px repeat(${order.length}, 1fr)`;

  return (
    <DashCard>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ color: C.muted, fontSize: 12 }}>// การทำงาน</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.ink }}>กิจกรรมรายวัน × เอเจนต์</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {HEATMAP_CATEGORIES.map((c) => {
          const active = c.id === cat;
          return (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              style={{ background: active ? C.ink : "transparent", color: active ? C.bg : C.inkSoft, border: `1px solid ${active ? C.ink : C.border}`, padding: "4px 10px", borderRadius: R.md, fontSize: 12, whiteSpace: "nowrap", cursor: "pointer" }}
            >
              {c.label}
            </button>
          );
        })}
      </div>
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 36 + order.length * 80 }}>
          <div style={{ display: "grid", gridTemplateColumns: cols, gap: 4, marginBottom: 8 }}>
            <div />
            {order.map((a, i) => (
              <div key={a} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <RankAvatar agent={a} gold={i === 0 && totals[i] > 0} size={28} />
                <div className="num" style={{ fontSize: 10, color: C.muted, letterSpacing: "0.06em" }}>{a.toUpperCase()}</div>
                <div className="num" style={{ fontSize: 10, color: i === 0 && totals[i] > 0 ? C.ink : C.muted, fontWeight: i === 0 ? 600 : 400 }}>{totals[i]}</div>
              </div>
            ))}
          </div>
          {rows.map(({ day, counts }) => {
            const isToday = day === DASH_DAY;
            return (
              <div key={day} style={{ display: "grid", gridTemplateColumns: cols, gap: 4, marginBottom: 4 }}>
                <div className="num" style={{ fontSize: 10, color: isToday ? C.accent : C.muted, textAlign: "right", paddingRight: 6, alignSelf: "center", fontWeight: isToday ? 600 : 400 }}>{day}</div>
                {counts.map((v, i) => {
                  const { bg, color } = heatCell(v, maxCell);
                  return (
                    <div key={i} style={{ height: 24, background: bg, outline: isToday ? `1px solid ${C.accent}55` : "none", borderRadius: R.sm, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_MONO, fontSize: 11, color }}>
                      {v > 0 ? v : ""}
                    </div>
                  );
                })}
              </div>
            );
          })}
          <HeatLegend />
        </div>
      </div>
    </DashCard>
  );
}

// ── Agent heatmap (green month calendar) ─────────────────────────────────────
export function AgentHeatmap({ agent }: { agent: DashAgent }) {
  const days = Array.from({ length: DASH_DAYS_IN_MONTH }, (_, i) => ({ day: i + 1, count: heatValue(agent, i + 1, "all") }));
  const maxCell = Math.max(1, ...days.map((d) => d.count));
  return (
    <DashCard>
      <div style={{ color: C.muted, fontSize: 12 }}>// กิจกรรม</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: C.ink, marginBottom: 16 }}>ความถี่กิจกรรมรายวัน</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 5 }}>
        {days.map((d) => {
          const isToday = d.day === DASH_DAY;
          const { bg, color } = heatCell(d.count, maxCell);
          return (
            <div key={d.day} style={{ position: "relative", aspectRatio: "1", background: bg, outline: isToday ? `1px solid ${C.accent}` : "none", borderRadius: R.sm, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
              <span className="num" style={{ fontSize: 9, color: C.muted, position: "absolute", top: 3, left: 4 }}>{d.day}</span>
              {d.count > 0 && <span className="num" style={{ fontSize: 12, color, fontWeight: 500 }}>{d.count}</span>}
            </div>
          );
        })}
      </div>
      <HeatLegend />
    </DashCard>
  );
}

function HeatLegend() {
  return (
    <div className="num" style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: C.muted }}>
      <span>น้อย</span>
      {[0.15, 0.3, 0.5, 0.7, 0.9].map((p) => (
        <span key={p} style={{ width: 14, height: 14, background: heatCell(p, 1).bg, borderRadius: R.sm }} />
      ))}
      <span>มาก</span>
    </div>
  );
}

// ── Input card (snapshot) ────────────────────────────────────────────────────
export function InputCard({
  eyebrow,
  title,
  hint,
  icon,
  hero,
  footnotes,
}: {
  eyebrow: string;
  title: string;
  hint?: string;
  icon: React.ReactNode;
  hero: { label: string; value: number | null; unit: string };
  footnotes: { label: string; value: number | null; unit: string; delta?: boolean; warn?: boolean }[];
}) {
  return (
    <DashCard>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 20 }}>
        <div style={{ flexShrink: 0, width: 36, height: 36, borderRadius: R.md, background: C.accentSoft, color: C.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
        <div>
          <Eyebrow>{eyebrow}</Eyebrow>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.ink, lineHeight: 1.1, marginTop: 2 }}>{title}</div>
          {hint && <div style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>{hint}</div>}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
        <span className="num" style={{ fontSize: 44, fontWeight: 600, color: C.ink, lineHeight: 1, letterSpacing: "-0.02em" }}>{hero.value ?? "–"}</span>
        <span style={{ fontSize: 13, color: C.muted }}>{hero.unit}</span>
      </div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 20 }}>{hero.label}</div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${footnotes.length}, 1fr)`, borderTop: `1px solid ${C.borderSoft}`, paddingTop: 16 }}>
        {footnotes.map((f, i) => {
          const active = f.warn && (f.value ?? 0) > 0;
          return (
            <div key={f.label} style={{ paddingLeft: i === 0 ? 0 : 16, borderLeft: i === 0 ? "none" : `1px solid ${C.borderSoft}` }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginBottom: 4 }}>
                <span className="num" style={{ fontSize: 20, fontWeight: 600, lineHeight: 1, color: active ? C.accent : f.delta ? C.pos : C.ink }}>
                  {f.value == null ? "–" : f.delta ? `+${f.value}` : f.value}
                </span>
                <span style={{ fontSize: 11, color: C.muted }}>{f.unit}</span>
                {active && <span className="num" style={{ fontSize: 9, color: C.accent, background: C.accentSoft, borderRadius: R.sm, padding: "2px 5px", marginLeft: 2 }}>⚠</span>}
              </div>
              <div style={{ fontSize: 11, color: C.inkSoft, lineHeight: 1.3 }}>{f.label}</div>
            </div>
          );
        })}
      </div>
    </DashCard>
  );
}
