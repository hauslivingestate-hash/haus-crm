import { Topbar } from "@/components/Topbar";
import { LastMatchBrowser } from "@/components/LastMatchBrowser";
import { getLastMatches } from "@/lib/queries";

export default async function LastMatchPage() {
  // Already scoped by RLS (own / team / all) before it reaches here, so the count below
  // is the viewer's own total — no company-wide figure leaks to an own-scoped sale.
  const matches = await getLastMatches();

  return (
    <>
      <Topbar title="Last Match" subtitle="บันทึกดีลที่ปิดได้" actions={false} />
      <div className="p-4 lg:p-6">
        <LastMatchBrowser matches={matches} />
      </div>
    </>
  );
}
