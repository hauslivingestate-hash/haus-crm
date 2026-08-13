import { Topbar } from "@/components/Topbar";
import { CompanyListings } from "@/components/CompanyListings";
import { getListings, getStaffDirectory } from "@/lib/queries";

export default async function CompanyListingsPage() {
  const [listings, agents] = await Promise.all([getListings(), getStaffDirectory()]);

  return (
    <>
      <Topbar
        title="ทรัพย์ทั้งบริษัท"
        subtitle="คลังทรัพย์รวมทุกเซล · ดูว่าใครดูแลทรัพย์ไหน สำหรับหา Co-Agent (ไม่แสดงข้อมูลเจ้าของ)"
        actions={false}
      />
      <div className="p-4 lg:p-6">
        <CompanyListings listings={listings} agents={agents} />
      </div>
    </>
  );
}
