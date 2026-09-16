import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Topbar } from "@/components/Topbar";
import { NewSalesDetail } from "@/components/NewSalesDetail";
import { getEmployees, getProbationTallies, getAgentActivities } from "@/lib/queries";

/* The FULL PAGE for one new sale. Reached by opening /new-sales/S-006 cold — a pasted
   link, a refresh, or any navigation that did not start on the leaderboard.

   A click from the board does NOT land here: Next intercepts it and renders the same
   <NewSalesDetail /> as a slide-over (app/(app)/new-sales/@drawer/(.)[id]/page.tsx).
   Everything below the Topbar is shared, so the page and the drawer cannot disagree. */
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

      <div className="px-4 pt-4 lg:px-6 lg:pt-6">
        <Link
          href="/new-sales"
          className="inline-flex items-center gap-1.5 text-small text-text-muted hover:text-text transition-colors"
        >
          <ArrowLeft size={14} strokeWidth={1.75} /> กลับไปอันดับเซลล์ใหม่
        </Link>
      </div>

      <NewSalesDetail
        employeeCode={employee.code}
        employees={employees}
        tallies={tallies}
        activities={activities}
      />
    </>
  );
}
