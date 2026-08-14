import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Topbar } from "@/components/Topbar";
import { NewSalesDetail } from "@/components/NewSalesDetail";
import { getEmployees, getProbationTallies, getAgentActivities } from "@/lib/queries";

// One new sale's probation stats — click-through from the เซลล์ใหม่ leaderboard.
export default async function NewSalesDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const code = decodeURIComponent(id);
  const employees = await getEmployees();
  const employee = employees.find((e) => e.code === code);
  // Only people currently IN the programme have a stats page — someone who has passed is
  // no longer being measured against the ladder.
  if (!employee || !employee.probationStart || employee.probationPassedAt) notFound();

  const [tallies, activities] = await Promise.all([
    getProbationTallies([{ code: employee.code, probationStart: employee.probationStart }]),
    getAgentActivities(employee.code),
  ]);

  return (
    <>
      <Topbar title="เซลล์ใหม่" actions={false} />
      <div className="p-4 lg:p-6 space-y-4">
        <Link
          href="/new-sales"
          className="inline-flex items-center gap-1.5 text-small text-text-muted hover:text-text transition-colors"
        >
          <ArrowLeft size={14} strokeWidth={1.75} /> กลับไปอันดับเซลล์ใหม่
        </Link>
        <NewSalesDetail
          employeeCode={employee.code}
          employees={employees}
          tallies={tallies}
          activities={activities}
        />
      </div>
    </>
  );
}
