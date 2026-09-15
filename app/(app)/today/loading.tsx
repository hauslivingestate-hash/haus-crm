import { Topbar } from "@/components/Topbar";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

export default function TodayLoading() {
  return (
    <>
      <Topbar title="แผนวันนี้" subtitle="กำลังโหลด…" actions={false} />
      <div className="p-4 lg:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 items-start">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <Skeleton className="h-9 w-40" />
              <Skeleton className="size-14 rounded-full" />
            </div>
            <div className="divide-y divide-border">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="size-5 rounded-md" />
                  <Skeleton className="h-4 flex-1" />
                </div>
              ))}
            </div>
          </Card>
          {/* The right rail: เป้าหมาย (TargetsBoard) then รายการรอ (BacklogCard). */}
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-12" />
              </CardHeader>
              <CardContent className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-1.5 w-full rounded-full" />
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-6 rounded-md" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-3 w-48" />
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
