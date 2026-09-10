import { Topbar } from "@/components/Topbar";
import { LeadsBrowser } from "@/components/LeadsBrowser";
import { getCrm } from "@/lib/queries";
import { getTablePrefs } from "@/lib/tables/queries";
import { getLookupColors, getSlaWindows } from "@/lib/tables/colors";

export default async function LeadsPage() {
  const [crm, prefs, colors, sla] = await Promise.all([
    getCrm(),
    getTablePrefs(),
    getLookupColors(),
    getSlaWindows(),
  ]);

  return (
    <>
      {/* No topbar add-action — lead intake is the global LeadIntakeFab (gated leads.create). */}
      <Topbar title="Lead" subtitle={`CRM ฝั่งผู้ซื้อ · ${crm.length} รายการ`} actions={false} />
      <div className="p-4 lg:p-6">
        <LeadsBrowser crm={crm} prefs={prefs.leads} colors={colors} sla={sla.lead} />
      </div>
    </>
  );
}
