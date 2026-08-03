import { Topbar } from "@/components/Topbar";
import { Skeleton } from "@/components/ui/Skeleton";

export default function ContactDetailLoading() {
  return (
    <>
      <Topbar title="ผู้ติดต่อ" actions={false} />
      <div className="p-4 lg:p-6 space-y-4">
        <Skeleton className="h-3.5 w-32" />
        {/* Identity header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-6 w-44" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <div className="flex items-center gap-2 sm:ml-auto">
            <Skeleton className="h-7 w-14" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-7 w-14" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 items-start">
          <Skeleton className="h-44 w-full rounded-lg" />
          <div className="flex flex-col gap-4">
            <Skeleton className="h-40 w-full rounded-lg" />
            <Skeleton className="h-32 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </>
  );
}
