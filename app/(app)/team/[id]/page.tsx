import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Topbar } from "@/components/Topbar";
import { EmployeeRecord } from "@/components/EmployeeRecord";
import { RevenueTargetEditor } from "@/components/RevenueTargetEditor";
import { getEmployee, getZoneOptions } from "@/lib/queries";
import { getAuthContext } from "@/lib/auth";
import { getStandingRevenueTargets } from "@/lib/salesDashboard";

export default async function EmployeeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  // `id` is the employee_code (S-002), not a seed user id — the roster is keyed on the
  // same value permissions run on.
  const { id } = await params;
  const { edit } = await searchParams;
  const code = decodeURIComponent(id);
  const [employee, zones, auth, standingTargets] = await Promise.all([
    getEmployee(code),
    getZoneOptions(),
    getAuthContext(),
    getStandingRevenueTargets(code),
  ]);
  if (!employee) notFound();

  // Ben, 2026-09-10: the CEO sets the sale's target, not the sale. Gated on the
  // permission rather than on "is CEO", so handing it to a Sales Leader later is a
  // switch in ตั้งค่า and not a code change. Never shown on your own record — setting
  // your own official number is the exact thing this is meant to prevent.
  const canSetTargets =
    !!auth &&
    auth.employeeCode !== code &&
    (auth.permissions.includes("targets.set") || auth.permissions.includes("roles.manage"));

  return (
    <>
      <Topbar title="ทีม / บุคคล" actions={false} />
      <div className="p-4 lg:p-6 space-y-4">
        <Link
          href="/team"
          className="inline-flex items-center gap-1.5 text-small text-text-muted hover:text-text transition-colors"
        >
          <ArrowLeft size={14} strokeWidth={1.75} /> กลับไปทีม
        </Link>
        <EmployeeRecord
          employee={employee}
          initialMode={edit ? "edit" : "view"}
          zones={zones}
        />
        {canSetTargets && (
          <RevenueTargetEditor
            employeeCode={code}
            nickname={employee.nickname || code}
            standing={standingTargets}
          />
        )}
      </div>
    </>
  );
}
