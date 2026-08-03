import { Topbar } from "@/components/Topbar";
import { NewSalesBoard } from "@/components/NewSalesBoard";

// เซลล์ใหม่ (probation) overview — CEO/Sales Leader only (nav gated performance.view_team).
// Ladder governance lives in Settings → Rank เซลล์ใหม่; this page is the read side.
export default function NewSalesPage() {
  return (
    <>
      <Topbar
        title="เซลล์ใหม่"
        subtitle="โปรเบชั่นเซลล์ใหม่ · Rank และความคืบหน้าเทียบเกณฑ์กิจกรรม"
        actions={false}
      />
      <div className="p-4 lg:p-6">
        <NewSalesBoard />
      </div>
    </>
  );
}
