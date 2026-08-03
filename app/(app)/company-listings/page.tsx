import { Topbar } from "@/components/Topbar";
import { CompanyListings } from "@/components/CompanyListings";
import { getListings } from "@/lib/queries";

export const revalidate = 30;

export default async function CompanyListingsPage() {
  const listings = await getListings();

  return (
    <>
      <Topbar
        title="ทรัพย์ทั้งบริษัท"
        subtitle="คลังทรัพย์รวมทุกเซล · ดูว่าใครดูแลทรัพย์ไหน สำหรับหา Co-Agent (ไม่แสดงข้อมูลเจ้าของ)"
        actions={false}
      />
      <div className="p-4 lg:p-6">
        <CompanyListings listings={listings} />
      </div>
    </>
  );
}
