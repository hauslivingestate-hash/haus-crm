import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Topbar } from "@/components/Topbar";
import { EmployeeRecord } from "@/components/EmployeeRecord";

export const revalidate = 30;

export default function NewEmployeePage() {
  return (
    <>
      <Topbar title="เพิ่มพนักงาน" actions={false} />
      <div className="p-4 lg:p-6 space-y-4">
        <Link
          href="/team"
          className="inline-flex items-center gap-1.5 text-small text-text-muted hover:text-text transition-colors"
        >
          <ArrowLeft size={14} strokeWidth={1.75} /> กลับไปทีม
        </Link>
        <EmployeeRecord employee={null} initialMode="edit" />
      </div>
    </>
  );
}
