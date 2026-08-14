import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Topbar } from "@/components/Topbar";
import { NewSalesDetail } from "@/components/NewSalesDetail";
import { getEmployee, getEmployees } from "@/lib/queries";

// One new sale's probation stats — click-through from the เซลล์ใหม่ leaderboard.
export default async function NewSalesDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const code = decodeURIComponent(id);
  const [employee, employees] = await Promise.all([getEmployee(code), getEmployees()]);
  // Only members of the probation program have a stats page — which is nobody until
  // date_started is filled in.
  if (!employee || !employee.probationStart) notFound();

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
        <NewSalesDetail employeeCode={employee.code} employees={employees} />
      </div>
    </>
  );
}
