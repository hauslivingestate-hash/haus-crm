import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Topbar } from "@/components/Topbar";
import { ListingDetail } from "@/components/ListingDetail";

/* The FULL PAGE for a listing. Reached by opening /listings/HBGY005 cold — a pasted
   link, a refresh, or a jump from a lead's "ทรัพย์ที่สนใจ" card.

   A click from the listings list does NOT land here: Next intercepts it and renders the
   same <ListingDetail /> as a slide-over instead
   (app/(app)/listings/@drawer/(.)[id]/page.tsx). */
export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <>
      <Topbar title="ทรัพย์" actions={false} />

      <div className="px-4 pt-4 lg:px-6 lg:pt-6">
        <Link
          href="/listings"
          className="inline-flex items-center gap-1.5 text-small text-text-muted hover:text-text transition-colors"
        >
          <ArrowLeft size={14} strokeWidth={1.75} /> กลับไปทรัพย์
        </Link>
      </div>

      <ListingDetail id={id} />
    </>
  );
}
