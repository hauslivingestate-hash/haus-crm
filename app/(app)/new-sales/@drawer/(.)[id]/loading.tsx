/* Fills the panel while the server resolves the agent's tallies.

   new-sales/[id]/loading.tsx belongs to the children slot and never fires for an
   intercepted route, so without this file the drawer would not appear at all until the
   data arrived — the click would look ignored. Shapes match NewSalesDetail: the identity
   card, a card per rank, then the activity log. */
export default function NewSalesDrawerLoading() {
  return (
    <div className="p-4 lg:p-5 space-y-4">
      <div className="h-24 rounded-lg border border-border bg-surface animate-pulse pr-11" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-32 rounded-lg border border-border bg-surface animate-pulse" />
      ))}
      <div className="h-48 rounded-lg border border-border bg-surface animate-pulse" />
    </div>
  );
}
