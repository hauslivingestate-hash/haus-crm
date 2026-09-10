import { LeadPeek } from "@/components/LeadPeek";

/* The drawer's loading state — and it is deliberately not a skeleton.

   leads/[id]/loading.tsx belongs to the children slot and never fires for an intercepted
   route, so this file is what fills the panel while the server works. <LeadPeek /> renders
   the row the grid already had (lib/peek.ts) using the real header and the real จัดการ
   pills, so the drawer opens filled in rather than shimmering.

   It takes no props: loading components receive none, so it reads the lead from the URL. */
export default function LeadDrawerLoading() {
  return <LeadPeek />;
}
