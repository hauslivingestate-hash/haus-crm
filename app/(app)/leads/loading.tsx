import { Topbar } from "@/components/Topbar";
import { SkeletonTable } from "@/components/ui/Skeleton";

export default function LeadsLoading() {
  return (
    <>
      <Topbar title="Lead" subtitle="กำลังโหลด…" />
      <div className="p-4 lg:p-6">
        <SkeletonTable
          toolbar
          minWidth="min-w-[1040px]"
          columns={[
            { label: "Lead ID", w: "w-14" },
            { label: "ลูกค้า", w: "w-32" },
            { label: "เกรด", w: "w-6" },
            { label: "สเตจ", w: "w-24" },
            { label: "สถานะ", w: "w-20" },
            { label: "ประเภท", w: "w-16" },
            { label: "เซล", w: "w-16" },
            { label: "งบประมาณ", w: "w-20", align: "right" },
            { label: "คอมมิชชั่น", w: "w-20", align: "right" },
            { label: "ติดตามล่าสุด", w: "w-20", align: "right" },
          ]}
        />
      </div>
    </>
  );
}
