/* Adds a second render slot alongside the page, so a lead's detail can appear OVER the
   list instead of replacing it. `drawer` is empty on every URL except /leads/:id reached
   by a click — see components/ui/Drawer.tsx for the reasoning, and @drawer/default.tsx
   for what fills it the rest of the time.

   The slot must exist at this level, not in (app)/layout.tsx: it is scoped to the leads
   list, so opening a lead from the dashboard or the notification bell gets the full page
   rather than a drawer over an unrelated screen. */
export default function LeadsLayout({
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
