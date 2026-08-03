"use client";

import * as React from "react";
import { Users, Building2 } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { AreaChart } from "@/components/ui/AreaChart";
import { C } from "@/components/dashboard/theme";
import {
  InputCard,
  AgentKpiRows,
  ActionBreakdownCard,
  AgentHeatmap,
  SectionHead,
  DashCard,
  Eyebrow,
  fmtTHB,
} from "@/components/dashboard/parts";
import {
  DASH_MONTHS,
  sumFlow,
  revenueSeries,
  actionBreakdown,
  snapshot,
  monthShort,
  type DashAgent,
} from "@/lib/dashboard";

export function DashboardAgent({
  agent,
  index,
  months,
  rangeLabel,
}: {
  agent: DashAgent;
  index: number;
  months: string[];
  rangeLabel: string;
}) {
  const period = sumFlow(agent, months, ["revenue", "closed_count", "new_leads", "new_listings"]);
  const annual = sumFlow(agent, DASH_MONTHS, ["revenue", "closed_count"]);
  const avgTicket = annual.closed_count > 0 ? annual.revenue / annual.closed_count : 0;
  const trend = revenueSeries(agent, DASH_MONTHS).map((p) => ({ label: monthShort(p.month), value: p.revenue }));
  const snap = snapshot(agent);
  const actions = actionBreakdown(agent, months);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <SectionHead
        index={index}
        total={7}
        eyebrow="เซลส์"
        title={`${agent}.`}
        subtitle="โปรไฟล์ของเซลส์รายบุคคล — ผลงาน · ฐานข้อมูล · กิจกรรม"
        avatar={<Avatar name={agent} tone="crimson" className="h-11 w-11 text-body" />}
      />

      {/* Period + annual */}
      <div className="dash-narrow-wide">
        <DashCard>
          <Eyebrow>รายได้ · {rangeLabel}</Eyebrow>
          <div className="num" style={{ fontSize: 44, fontWeight: 600, color: C.ink, lineHeight: 1.02, letterSpacing: "-0.02em", marginTop: 12 }}>
            {fmtTHB(period.revenue)}
          </div>
          <div className="num" style={{ fontSize: 12, color: C.muted, marginTop: 10 }}>{period.closed_count} ดีลปิด · {rangeLabel}</div>
        </DashCard>

        <DashCard>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
            <div>
              <Eyebrow>รายได้ · ปีนี้</Eyebrow>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
                <span className="num" style={{ fontSize: 40, fontWeight: 600, color: C.ink, lineHeight: 1.02, letterSpacing: "-0.02em" }}>{fmtTHB(annual.revenue)}</span>
                <span style={{ color: C.muted, fontSize: 12 }} className="num">{annual.closed_count} ดีล</span>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <Eyebrow>ค่าเฉลี่ย/ดีล</Eyebrow>
              <div className="num" style={{ fontSize: 22, fontWeight: 600, color: C.ink, lineHeight: 1, marginTop: 6 }}>{fmtTHB(avgTicket)}</div>
            </div>
          </div>
          <AreaChart data={trend} height={170} format={fmtTHB} color={C.accent} />
        </DashCard>
      </div>

      {/* Inputs */}
      <div className="dash-grid-2">
        <InputCard
          eyebrow="ฝั่งผู้ซื้อ"
          title="ผู้ซื้อ"
          hint="ฐานข้อมูลผู้ซื้อที่ดูแลอยู่ · ปัจจุบัน"
          icon={<Users size={18} strokeWidth={1.75} />}
          hero={{ label: "Active ทั้งหมด · ปัจจุบัน", value: snap.active_buyers, unit: "คน" }}
          footnotes={[
            { label: `ลีดใหม่ · ${rangeLabel}`, value: period.new_leads, unit: "คน", delta: true },
            { label: "ค้าง Lead >2 วัน · ปัจจุบัน", value: snap.overdue_leads, unit: "คน", warn: true },
          ]}
        />
        <InputCard
          eyebrow="ฝั่งเจ้าของ"
          title="ลิสติ้ง"
          hint="ฐานข้อมูลลิสติ้งที่ถือ · ปัจจุบัน"
          icon={<Building2 size={18} strokeWidth={1.75} />}
          hero={{ label: "Active ทั้งหมด · ปัจจุบัน", value: snap.active_listings, unit: "รายการ" }}
          footnotes={[
            { label: "A-list (Active) · ปัจจุบัน", value: snap.active_alist, unit: "รายการ" },
            { label: `ลิสต์ใหม่ · ${rangeLabel}`, value: period.new_listings, unit: "รายการ", delta: true },
          ]}
        />
      </div>

      <AgentKpiRows agent={agent} />

      {/* Activity */}
      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 28 }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ color: C.muted, fontSize: 12 }}>// กิจกรรม</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.ink }}>กิจกรรม · {rangeLabel}</div>
          <div style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>แอคชั่นทั้งหมดของ {agent} · {rangeLabel}</div>
        </div>

        <DashCard style={{ marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            <ActionStat label="แอคชั่นทั้งหมด" value={actions.total} />
            <ActionStat label="ฝั่งผู้ซื้อ" value={actions.buyerTotal} />
            <ActionStat label="ฝั่งเจ้าของ" value={actions.ownerTotal} />
          </div>
        </DashCard>

        <div className="dash-grid-2" style={{ marginBottom: 16 }}>
          <ActionBreakdownCard eyebrow="ฝั่งเจ้าของ" title="กิจกรรมฝั่งเจ้าของ" hint="ลิสติ้ง + การคุยกับเจ้าของ" items={actions.owner} highlightKey="new_list" />
          <ActionBreakdownCard eyebrow="ฝั่งผู้ซื้อ" title="กิจกรรมฝั่งผู้ซื้อ" hint="ไปป์ไลน์ผู้ซื้อ" items={actions.buyer} highlightKey="close" />
        </div>
        <div className="dash-grid-2">
          <ActionBreakdownCard eyebrow="อื่นๆ" title="กิจกรรมอื่นๆ" hint="สำรวจ · ธุรการ · บริษัท" items={actions.other} />
          <AgentHeatmap agent={agent} />
        </div>
      </div>
    </div>
  );
}

function ActionStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div style={{ color: C.muted, fontSize: 11, marginBottom: 6 }}>{label}</div>
      <div className="num" style={{ fontSize: 28, color: C.ink, fontWeight: 500 }}>{value}</div>
    </div>
  );
}
