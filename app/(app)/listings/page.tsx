import { Topbar } from "@/components/Topbar";
import { ListingsBrowser } from "@/components/ListingsBrowser";
import { ListingIntakeButton } from "@/components/ListingIntakeButton";
import { getListings } from "@/lib/queries";

export const revalidate = 30;

export default async function ListingsPage() {
  const listings = await getListings();

  return (
    <>
      <Topbar title="ทรัพย์" subtitle={`ประกาศทั้งหมด · ${listings.length} รายการ`} actions={<ListingIntakeButton />} />
      <div className="p-4 lg:p-6">
        <ListingsBrowser listings={listings} />
      </div>
    </>
  );
}
