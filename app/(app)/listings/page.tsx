import { Topbar } from "@/components/Topbar";
import { ListingsBrowser } from "@/components/ListingsBrowser";
import { ListingIntakeButton } from "@/components/ListingIntakeButton";
import { getMyListings, getListingCovers } from "@/lib/queries";
import { getAssignableAgents } from "@/lib/lookups";

// This page reads the session, so it renders per request. `revalidate` is gone rather than
// ignored: a cached copy of one agent's inventory served to another is exactly the bug.
export default async function ListingsPage() {
  const [listings, agents, covers] = await Promise.all([
    getMyListings(),
    getAssignableAgents(),
    getListingCovers(),
  ]);

  return (
    <>
      <Topbar title="ทรัพย์" subtitle={`ทรัพย์ที่ฉันดูแล · ${listings.length} รายการ`} actions={<ListingIntakeButton agents={agents} />} />
      <div className="p-4 lg:p-6">
        <ListingsBrowser listings={listings} covers={covers} />
      </div>
    </>
  );
}
