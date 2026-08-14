import { Topbar } from "@/components/Topbar";
import { NewSalesBoard } from "@/components/NewSalesBoard";
import { getEmployees } from "@/lib/queries";

// เซลล์ใหม่ (probation) overview — CEO/Sales Leader only (nav gated performance.view_team).
// Ladder governance lives in Settings → Rank เซลล์ใหม่; this page is the read side.
//
// The roster is real (main_1_hr) but `date_started` is empty for all 10, so nobody can be
// placed in the program yet and the board renders its "waiting on HR" state.
export default async function NewSalesPage() {
  const employees = await getEmployees();

  return (
    <>
      <Topbar
        title="เซลล์ใหม่"
        subtitle="โปรเบชั่นเซลล์ใหม่ · Rank และความคืบหน้าเทียบเกณฑ์กิจกรรม"
        actions={false}
      />
      <div className="p-4 lg:p-6">
        <NewSalesBoard employees={employees} />
      </div>
    </>
  );
}
