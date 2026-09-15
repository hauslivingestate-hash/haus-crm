import { Topbar } from "@/components/Topbar";
import { Skeleton, SkeletonStatRow } from "@/components/ui/Skeleton";

/* Loading state for / — the same shape as the dashboard it stands in for: the sticky
   filter row, then the hybrid grid (components/dashboard/SalesDashboard.tsx) — four
   tiles, the target bar, the trend and the pipeline on the left; the day on the right.
   The tab strip is left out: whether the viewer gets one is a permission the page has
   not resolved yet, and a strip that then vanishes is worse than none. The ทีม tab has
   no right column, so for a leader the right third shimmers briefly and empties; the
   sales tab is what most viewers land on and what this mirrors. */
export default function DashboardLoading() {
  return (
    <>
      <Topbar title="แดชบอร์ด" subtitle="กำลังโหลด…" actions={false} />
      <div className="sticky top-14 z-20 border-b border-border bg-background/85 px-4 py-2.5 backdrop-blur lg:px-6">
        <div className="flex items-center gap-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-7 w-16 rounded-full" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 p-4 xl:grid-cols-3 lg:p-6">
        <div className="flex flex-col gap-4 xl:col-span-2">
          <SkeletonStatRow />
          <Skeleton className="h-36 rounded-lg" />
          <Skeleton className="h-60 rounded-lg" />
          <Skeleton className="h-80 rounded-lg" />
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-96 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
          <Skeleton className="h-40 rounded-lg" />
        </div>
      </div>
    </>
  );
}
