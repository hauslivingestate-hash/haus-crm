import { ListingDetail } from "@/components/ListingDetail";

/* The intercepted /listings/:id — the drawer's contents. The panel itself is layout.tsx. */
export default async function ListingDrawer({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ListingDetail id={id} inDrawer />;
}
