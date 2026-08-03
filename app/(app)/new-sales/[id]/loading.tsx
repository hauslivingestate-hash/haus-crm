import { Topbar } from "@/components/Topbar";

export default function NewSalesDetailLoading() {
  return (
    <>
      <Topbar title="เซลล์ใหม่" actions={false} />
      <div className="p-4 lg:p-6 space-y-4">
        <div className="h-20 rounded-lg border border-border bg-surface animate-pulse" />
        <div className="h-64 rounded-lg border border-border bg-surface animate-pulse" />
      </div>
    </>
  );
}
