import { Topbar } from "@/components/Topbar";
import { LeadsBrowser } from "@/components/LeadsBrowser";
import { getCrm } from "@/lib/queries";

export default async function LeadsPage() {
  const crm = await getCrm();

  return (
    <>
      {/* No topbar add-action — lead intake is the global LeadIntakeFab (gated leads.create). */}
      <Topbar title="Lead" subtitle={`CRM ฝั่งผู้ซื้อ · ${crm.length} รายการ`} actions={false} />
      <div className="p-4 lg:p-6">
        <LeadsBrowser crm={crm} />
      </div>
    </>
  );
}
