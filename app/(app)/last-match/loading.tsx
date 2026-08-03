import { Topbar } from "@/components/Topbar";
import { SkeletonTable } from "@/components/ui/Skeleton";

export default function LastMatchLoading() {
  return (
    <>
      <Topbar title="Last Match" subtitle="กำลังโหลด…" actions={false} />
      <div className="p-4 lg:p-6">
        <SkeletonTable
          toolbar
          minWidth="min-w-[920px]"
          columns={[
            { label: "วันที่", w: "w-16" },
            { label: "โครงการ", w: "w-32" },
            { label: "โซน", w: "w-20" },
            { label: "ขนาด", w: "w-20" },
            { label: "ห้อง", w: "w-12" },
            { label: "ราคาปิด", w: "w-20", align: "right" },
            { label: "ประเภทการปิด", w: "w-24" },
            { label: "เซลส์", w: "w-12" },
            { label: "หมายเหตุ", w: "w-32" },
          ]}
        />
      </div>
    </>
  );
}
