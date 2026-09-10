import { Drawer } from "@/components/ui/Drawer";

/* The drawer SHELL lives in a layout, not in page.tsx, so it survives the swap from
   loading.tsx to the loaded page.

   Next nests loading inside layout (layout → loading → page). Putting <Drawer> here
   means one panel mounts once and its contents change underneath it. Putting it in both
   page.tsx and loading.tsx instead — the obvious first cut — mounts two separate panels:
   the slide-in animation plays twice, and the body scroll-lock is released and retaken
   mid-swap, which lets the list behind jump. */
export default function LeadDrawerLayout({ children }: { children: React.ReactNode }) {
  return <Drawer title="Lead">{children}</Drawer>;
}
