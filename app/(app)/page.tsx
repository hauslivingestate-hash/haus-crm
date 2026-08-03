import { LayoutDashboard } from "lucide-react";
import { Topbar } from "@/components/Topbar";

export const revalidate = 30;

// TEMPORARY: the analytics dashboard (components/dashboard/Dashboard, ported from the
// HAUS V2 sales dashboard) is hidden behind this coming-soon placeholder while it's
// being reworked. To restore: render <Dashboard /> here again (see git history of this
// file) — components/dashboard/* and lib/dashboard.ts are untouched.
export default function DashboardPage() {
  return (
    <>
      <Topbar title="แดชบอร์ด" subtitle="ภาพรวมทีมและรายบุคคล" actions={false} />
      <div className="flex-1 grid place-items-center p-6">
        <div className="flex flex-col items-center gap-3 text-center max-w-sm">
          <div className="size-14 grid place-items-center rounded-2xl bg-surface-2 border border-border">
            <LayoutDashboard size={26} strokeWidth={1.75} className="text-text-subtle" />
          </div>
          <div className="text-h2">เร็วๆ นี้</div>
          <p className="text-body text-text-subtle">
            แดชบอร์ดภาพรวมกำลังอยู่ระหว่างการปรับปรุง — ระหว่างนี้ดูข้อมูลได้จากหน้า ลีดของฉัน,
            ฐานข้อมูลลีด และ ผลงาน
          </p>
        </div>
      </div>
    </>
  );
}
