import { Topbar } from "@/components/Topbar";
import { SkeletonDetail } from "@/components/ui/Skeleton";

export default function ListingDetailLoading() {
  return (
    <>
      <Topbar title="ทรัพย์" actions={false} />
      <SkeletonDetail />
    </>
  );
}
