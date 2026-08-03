import { Topbar } from "@/components/Topbar";
import { Skeleton } from "@/components/ui/Skeleton";

// Loading state for / — the dashboard is temporarily a coming-soon placeholder
// (see app/page.tsx), so this is a minimal centered skeleton, not the old
// dashboard-shaped one. Restore the layout skeleton together with <Dashboard />.
export default function DashboardLoading() {
  return (
    <>
      <Topbar title="แดชบอร์ด" subtitle="กำลังโหลด…" actions={false} />
      <div className="flex-1 grid place-items-center p-6">
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="size-14 rounded-2xl" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
    </>
  );
}
