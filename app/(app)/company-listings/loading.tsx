import { Topbar } from "@/components/Topbar";
import { SkeletonTable } from "@/components/ui/Skeleton";

export default function CompanyListingsLoading() {
  return (
    <>
      <Topbar title="ทรัพย์ทั้งบริษัท" subtitle="กำลังโหลด…" />
      <div className="p-4 lg:p-6">
        <SkeletonTable
          toolbar
          minWidth="min-w-[1120px]"
          columns={[
            { label: "Listing ID", w: "w-16" },
            { label: "โครงการ", w: "w-32" },
            { label: "โซน", w: "w-20" },
            { label: "ประเภท", w: "w-16" },
            { label: "ห้อง", w: "w-12", align: "right" },
            { label: "พื้นที่", w: "w-16", align: "right" },
            { label: "Potential", w: "w-20" },
            { label: "สถานะ", w: "w-24" },
            { label: "ราคา", w: "w-20", align: "right" },
            { label: "ผู้ดูแล", w: "w-24" },
            { label: "ติดต่อเซล", w: "w-24" },
          ]}
        />
      </div>
    </>
  );
}
