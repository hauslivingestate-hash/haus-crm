import { Topbar } from "@/components/Topbar";
import { NewSalesBoard } from "@/components/NewSalesBoard";
import { getEmployees, getProbationTallies } from "@/lib/queries";

// เซลล์ใหม่ (probation) overview — CEO/Sales Leader only (nav gated performance.view_team).
// Ladder governance lives in Settings → Rank เซลล์ใหม่; this page is the read side.
export default async function NewSalesPage() {
  const employees = await getEmployees();
  // Only the people actually on the board need tallies — everyone else has passed.
  const members = employees
    .filter((e) => e.status === "active" && e.probationStart && !e.probationPassedAt)
    .map((e) => ({ code: e.code, probationStart: e.probationStart }));
  const tallies = await getProbationTallies(members);

  return (
    <>
      <Topbar
        title="เซลล์ใหม่"
        subtitle="โปรเบชั่นเซลล์ใหม่ · Rank และความคืบหน้าเทียบเกณฑ์กิจกรรม"
        actions={false}
      />
      <div className="p-4 lg:p-6">
        <NewSalesBoard employees={employees} tallies={tallies} />
      </div>
    </>
  );
}
