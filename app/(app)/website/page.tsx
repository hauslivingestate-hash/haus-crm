import { Globe } from "lucide-react";
import { Topbar } from "@/components/Topbar";

// PLACEHOLDER: Marketing's page for managing the customer-facing portal website
// (menu, banners, featured content). Can't be designed yet — the portal itself
// doesn't exist. Nav entry + website.manage permission are already wired (Marketing
// + CEO); replace this body with the real manager once the portal is designed.
export default function WebsitePage() {
  return (
    <>
      <Topbar title="เว็บพอร์ทัล" subtitle="จัดการเมนูและเนื้อหาเว็บหน้าบ้าน" actions={false} />
      <div className="flex-1 grid place-items-center p-6">
        <div className="flex flex-col items-center gap-3 text-center max-w-sm">
          <div className="size-14 grid place-items-center rounded-2xl bg-surface-2 border border-border">
            <Globe size={26} strokeWidth={1.75} className="text-text-subtle" />
          </div>
          <div className="text-h2">เร็วๆ นี้</div>
          <p className="text-body text-text-subtle">
            หน้านี้จะใช้จัดการเมนู แบนเนอร์ และเนื้อหาบนเว็บพอร์ทัลลูกค้า —
            จะเปิดใช้งานเมื่อออกแบบเว็บหน้าบ้านเสร็จ
          </p>
        </div>
      </div>
    </>
  );
}
