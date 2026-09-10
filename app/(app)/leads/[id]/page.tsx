import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Topbar } from "@/components/Topbar";
import { LeadDetail } from "@/components/LeadDetail";

/* The FULL PAGE for a lead. Reached by opening /leads/L26-322 cold — a notification, a
   pasted link, a refresh, or any navigation that did not start on the leads list.

   A click from the list does NOT land here: Next intercepts it and renders the same
   <LeadDetail /> as a slide-over instead (app/(app)/leads/@drawer/(.)[id]/page.tsx).
   Everything below the Topbar is shared, so this page and that drawer can never show
   different information. */
export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <>
      <Topbar title="Lead" actions={false} />

      <div className="px-4 pt-4 lg:px-6 lg:pt-6">
        <Link
          href="/leads"
          className="inline-flex items-center gap-1.5 text-small text-text-muted hover:text-text transition-colors"
        >
          <ArrowLeft size={14} strokeWidth={1.75} /> กลับไป Lead
        </Link>
      </div>

      <LeadDetail id={id} />
    </>
  );
}
