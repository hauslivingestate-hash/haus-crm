import { Drawer } from "@/components/ui/Drawer";

/* See app/(app)/leads/@drawer/(.)[id]/layout.tsx for why the shell is a layout.

   A little wider than the lead drawer (520 vs 460): a listing carries the photo manager,
   the spec grid and the value-add checklist. Both are narrower than a page on purpose —
   the list behind stays visible, which is what makes it read as a panel over your work
   rather than as having navigated away from it. */
export default function ListingDrawerLayout({ children }: { children: React.ReactNode }) {
  return (
    <Drawer title="ทรัพย์" width="sm:max-w-[520px]">
      {children}
    </Drawer>
  );
}
