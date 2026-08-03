import { Topbar } from "@/components/Topbar";
import { SkeletonTable } from "@/components/ui/Skeleton";

export default function AssignLoading() {
  return (
    <>
      <Topbar title="มอบหมาย Lead" subtitle="กำลังโหลด…" actions={false} />
      <div className="p-4 lg:p-6">
        <SkeletonTable
          toolbar
          minWidth="min-w-[820px]"
          columns={[
            { label: "ลูกค้า", w: "w-28" },
            { label: "สเตจ", w: "w-20" },
            { label: "Potential", w: "w-16" },
            { label: "งบ", w: "w-16", align: "right" },
            { label: "ทรัพย์", w: "w-20" },
            { label: "มอบหมายให้", w: "w-28" },
          ]}
        />
      </div>
    </>
  );
}
