import { Topbar } from "@/components/Topbar";
import { SkeletonTable } from "@/components/ui/Skeleton";

export default function ContactsLoading() {
  return (
    <>
      <Topbar title="ผู้ติดต่อ" subtitle="กำลังโหลด…" />
      <div className="p-4 lg:p-6">
        <SkeletonTable
          toolbar
          rows={6}
          columns={[
            { label: "ชื่อ", w: "w-40" },
            { label: "บทบาท", w: "w-16" },
            { label: "เบอร์โทร", w: "w-24" },
            { label: "LINE", w: "w-20" },
          ]}
        />
      </div>
    </>
  );
}
