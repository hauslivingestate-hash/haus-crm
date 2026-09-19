import { notFound, redirect } from "next/navigation";
import { Topbar } from "@/components/Topbar";
import { SupportDesk } from "@/components/support/SupportDesk";
import { FacebookBoard } from "@/components/support/FacebookBoard";
import { getAuthContext } from "@/lib/auth";
import { getFbBoard, getSupportQueue, getSupportStaff } from "@/lib/support";

// โต๊ะงาน Support — Listing Support's own pages (Ben, 2026-09-19). A separate route on
// purpose: changing these screens for Benz touches nothing a sale sees.
export const dynamic = "force-dynamic";

type Kind = "new" | "update" | "facebook";

const PAGES: Record<Kind, { title: string; subtitle: string }> = {
  new: { title: "ลงประกาศใหม่", subtitle: "ทรัพย์ที่เซลส่งมาให้ลงประกาศ (Ready to Post)" },
  update: { title: "อัปเดตประกาศ", subtitle: "ประกาศที่ต้องแก้หรือปิด (Update · Sold · Cancel)" },
  facebook: { title: "Facebook Post", subtitle: "ทรัพย์ Exclusive / A-List ที่ประกาศอยู่ · จัดกลุ่มตามเซล" },
};

export default async function SupportPage({ params }: { params: Promise<{ kind: string }> }) {
  const [{ kind }, auth] = await Promise.all([params, getAuthContext()]);
  const perms = new Set(auth?.permissions ?? []);
  if (!(perms.has("support.workspace") || perms.has("roles.manage"))) redirect("/");
  if (!(kind in PAGES)) notFound();
  const k = kind as Kind;

  return (
    <>
      <Topbar title={PAGES[k].title} subtitle={PAGES[k].subtitle} actions={false} />
      <div className="p-4 lg:p-6">
        {k === "facebook" ? (
          <FacebookBoard rows={(await getFbBoard()).rows} />
        ) : (
          <SupportDesk kind={k} listings={await getSupportQueue(k)} staff={await getSupportStaff()} />
        )}
      </div>
    </>
  );
}
