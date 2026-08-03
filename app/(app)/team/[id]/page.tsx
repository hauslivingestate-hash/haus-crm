import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Topbar } from "@/components/Topbar";
import { EmployeeRecord } from "@/components/EmployeeRecord";
import { getEmployee } from "@/lib/team";

export default async function EmployeeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id } = await params;
  const { edit } = await searchParams;
  const employee = getEmployee(id);
  if (!employee) notFound();

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
        <EmployeeRecord employee={employee} initialMode={edit ? "edit" : "view"} />
      </div>
    </>
  );
}
