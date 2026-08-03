import { Topbar } from "@/components/Topbar";
import { LastMatchBrowser } from "@/components/LastMatchBrowser";
import { listMatches } from "@/lib/lastMatch";

export const revalidate = 30;

export default function LastMatchPage() {
  const matches = listMatches();

  return (
    <>
      {/* No row count here: scoping is resolved client-side (own / team / all), so a
          server-rendered total would leak the company-wide figure to an own-scoped sale.
          The scoped count lives in the browser's filter chips instead. */}
      <Topbar title="Last Match" subtitle="บันทึกดีลที่ปิดได้" actions={false} />
      <div className="p-4 lg:p-6">
        <LastMatchBrowser matches={matches} />
      </div>
    </>
  );
}
