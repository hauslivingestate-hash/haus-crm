/* Adds a second render slot alongside the leaderboard, so one new sale's stats can appear
   OVER the ranking instead of replacing it — the same shape as /leads and /listings.
   See components/ui/Drawer.tsx for why the drawer is a route and not a useState.

   Scoped here rather than in (app)/layout.tsx: opening /new-sales/S-006 from anywhere
   other than this board should get the full page, not a panel over an unrelated screen. */
export default function NewSalesLayout({
  children,
  drawer,
}: {
  children: React.ReactNode;
  drawer: React.ReactNode;
}) {
  return (
    <>
      {children}
      {drawer}
    </>
  );
}
