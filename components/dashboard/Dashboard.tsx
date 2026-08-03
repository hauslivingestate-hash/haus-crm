"use client";

import * as React from "react";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
import { DashboardAgent } from "@/components/dashboard/DashboardAgent";
import { C, R } from "@/components/dashboard/theme";
import {
  DASH_AGENTS,
  DASH_MONTHS,
  RANGE_PRESETS,
  monthsInRange,
  rangeLabel as fmtRange,
  type RangeId,
  type DashAgent,
} from "@/lib/dashboard";

type Tab = "overview" | DashAgent;
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "ภาพรวม" },
  ...DASH_AGENTS.map((a) => ({ id: a as Tab, label: a })),
];

export function Dashboard() {
  const [tab, setTab] = React.useState<Tab>("overview");
  const [range, setRange] = React.useState<RangeId>("this");

  const months = monthsInRange(range);
  const idx0 = DASH_MONTHS.indexOf(months[0]);
  const prevMonths = DASH_MONTHS.slice(Math.max(0, idx0 - months.length), idx0);
  const rangeLabel = fmtRange(range);
  const showPace = range === "this";
  const agentIndex = tab !== "overview" ? DASH_AGENTS.indexOf(tab) + 2 : 1;

  return (
    <div style={{ background: C.bg, minHeight: "100%" }}>
      {/* Sub-tab bar: team overview + one tab per agent (sticks below the h-14 Topbar) */}
      <div className="sticky top-14 z-20" style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "stretch", gap: 4, padding: "0 16px", overflowX: "auto" }}>
          {TABS.map((t, i) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  height: 46,
                  padding: "0 6px",
                  whiteSpace: "nowrap",
                  borderBottom: `2px solid ${active ? C.accent : "transparent"}`,
                  marginBottom: -1,
                  color: active ? C.ink : C.muted,
                  fontWeight: active ? 600 : 400,
                  fontSize: 14,
                  background: "transparent",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                <span className="num" style={{ fontSize: 10, color: active ? C.accent : C.muted, letterSpacing: "0.05em" }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Month-range picker */}
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 16px", borderBottom: `1px solid ${C.borderSoft}` }}>
        <div style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
          {RANGE_PRESETS.map((r) => {
            const active = range === r.id;
            return (
              <button
                key={r.id}
                onClick={() => setRange(r.id)}
                style={{
                  height: 30,
                  padding: "0 12px",
                  borderRadius: R.md,
                  fontSize: 12,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  background: active ? C.ink : C.card,
                  color: active ? C.bg : C.inkSoft,
                  border: `1px solid ${active ? C.ink : C.border}`,
                  fontWeight: active ? 600 : 400,
                }}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "28px 16px 64px" }} className="dash-body">
        {tab === "overview" ? (
          <DashboardOverview months={months} prevMonths={prevMonths} showPace={showPace} />
        ) : (
          <DashboardAgent agent={tab} index={agentIndex} months={months} rangeLabel={rangeLabel} />
        )}
      </div>
    </div>
  );
}
