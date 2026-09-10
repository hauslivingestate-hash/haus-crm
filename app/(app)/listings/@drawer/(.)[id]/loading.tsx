import { Skeleton } from "@/components/ui/Skeleton";

/* A listing runs eight queries before it can render, so without this the click would
   look ignored for most of a second. The panel is already on screen (layout.tsx). */
export default function ListingDrawerLoading() {
  return (
    <div className="p-4 lg:p-5 space-y-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-2.5 w-40" />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="h-52 w-full rounded-lg" />
      <Skeleton className="h-16 w-full rounded-lg" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}
