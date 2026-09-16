import { Drawer } from "@/components/ui/Drawer";

/* The drawer SHELL lives in a layout, not in page.tsx, so it survives the swap from
   loading.tsx to the loaded page — Next nests layout → loading → page. Mounting <Drawer>
   in both instead plays the slide-in twice and drops the body scroll-lock mid-swap.

   Wider than the lead drawer (460px) because this panel carries the whole ladder: a
   progress bar per criterion, each with a label, a track and a have/target figure. */
export default function NewSalesDrawerLayout({ children }: { children: React.ReactNode }) {
  return (
    <Drawer title="เซลล์ใหม่" width="sm:max-w-[600px]">
      {children}
    </Drawer>
  );
}
