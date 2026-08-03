import { Topbar } from "@/components/Topbar";
import { LeadAssignment } from "@/components/LeadAssignment";
import { getCrm } from "@/lib/queries";

export const revalidate = 30;

export default async function AssignPage() {
  const leads = await getCrm();

  return (
    <>
      <Topbar title="Lead Database" subtitle="ลีดทั้งหมดที่รับเข้าและมอบหมาย · สำหรับตรวจสอบ อ้างอิง และทำรายงาน" actions={false} />
      <div className="p-4 lg:p-6">
        <LeadAssignment leads={leads} />
      </div>
    </>
  );
}
