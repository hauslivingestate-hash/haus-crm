import { Topbar } from "@/components/Topbar";
import { LeadAssignment } from "@/components/LeadAssignment";
import { getCrm } from "@/lib/queries";
import { getAssignableAgents } from "@/lib/lookups";

export default async function AssignPage() {
  const [leads, agents] = await Promise.all([getCrm(), getAssignableAgents()]);

  return (
    <>
      <Topbar title="Lead Database" subtitle="ลีดทั้งหมดที่รับเข้าและมอบหมาย · สำหรับตรวจสอบ อ้างอิง และทำรายงาน" actions={false} />
      <div className="p-4 lg:p-6">
        <LeadAssignment leads={leads} agents={agents} />
      </div>
    </>
  );
}
