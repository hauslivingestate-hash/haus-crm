import { Topbar } from "@/components/Topbar";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

export default function SettingsLoading() {
  return (
    <>
      <Topbar title="ตั้งค่า" subtitle="กำลังโหลด…" actions={false} />
      <div className="p-4 lg:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-4 items-start">
          <div className="flex lg:flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
          <div className="space-y-4">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-12 w-full rounded-lg" />
            <Card className="p-4 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
