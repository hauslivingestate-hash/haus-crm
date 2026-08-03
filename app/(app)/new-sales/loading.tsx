import { Topbar } from "@/components/Topbar";

export default function NewSalesLoading() {
  return (
    <>
      <Topbar title="เซลล์ใหม่" subtitle="กำลังโหลด…" actions={false} />
      <div className="p-4 lg:p-6 space-y-4">
        {[0, 1].map((i) => (
          <div key={i} className="h-40 rounded-lg border border-border bg-surface animate-pulse" />
        ))}
      </div>
    </>
  );
}
