import { Topbar } from "@/components/Topbar";
import { PipelineBoard } from "@/components/PipelineBoard";
import { Stat } from "@/components/ui/Stat";
import { getCrm } from "@/lib/queries";
import { formatBaht, formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const crm = await getCrm();
  const active = crm.filter((c) => c.lead_status === "Active");
  const value = active.reduce((a, c) => a + (c.budget ?? 0), 0);
  const wins = crm.filter((c) => c.lead_status === "Win");
  const winRate = crm.length ? Math.round((wins.length / crm.length) * 100) : 0;

  return (
    <>
      <Topbar title="ไปป์ไลน์" subtitle="ดีลที่กำลังดำเนินการ แยกตามสเตจ" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="ดีล Active" value={formatNumber(active.length)} />
          <Stat label="มูลค่ารวม" value={formatBaht(value)} />
          <Stat label="ปิดได้ (Win)" value={formatNumber(wins.length)} />
          <Stat label="Win Rate" value={`${winRate}%`} />
        </div>
        <PipelineBoard rows={crm} />
      </div>
    </>
  );
}
