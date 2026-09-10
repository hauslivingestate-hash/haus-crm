import { LeadDetail } from "@/components/LeadDetail";

/* The intercepted /leads/:id — the drawer's contents. The panel itself is layout.tsx.

   `(.)` matches a segment at the same level as this slot's parent. Slots are not route
   segments, so @drawer does not count as a level: Next resolves
   /(app)/leads/@drawer/(.)[id] to /leads/[id].

   Same <LeadDetail /> the full page renders; only the frame differs. */
export default async function LeadDrawer({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LeadDetail id={id} inDrawer />;
}
