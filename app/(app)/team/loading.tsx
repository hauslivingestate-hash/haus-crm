import { Topbar } from "@/components/Topbar";
import { SkeletonTable } from "@/components/ui/Skeleton";

export default function TeamLoading() {
  return (
    <>
      <Topbar title="ทีม / บุคคล" subtitle="กำลังโหลด…" actions={false} />
      <div className="p-4 lg:p-6">
        <SkeletonTable
          minWidth="min-w-[720px]"
          columns={[
            { label: "พนักงาน", w: "w-32" },
            { label: "บทบาท", w: "w-28" },
            { label: "โซน", w: "w-20" },
            { label: "สถานะ", w: "w-16" },
            { label: "กิจกรรมเดือนนี้", w: "w-12", align: "right" },
            { label: "คอมมิชชั่น", w: "w-20", align: "right" },
            { label: "จัดการ", w: "w-8", align: "right" },
          ]}
        />
      </div>
    </>
  );
}
