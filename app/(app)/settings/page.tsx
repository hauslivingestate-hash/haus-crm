import { Topbar } from "@/components/Topbar";
import { SettingsView } from "@/components/SettingsView";
import { getListings, getEmployees, getZones, getActionTypes } from "@/lib/queries";
import { getAccounts } from "@/lib/accounts";

export default async function SettingsPage() {
  // Live usage per property type (v_main_listing) — powers the delete-confirm impact line
  // ("มี N ทรัพย์ที่ใช้ค่านี้อยู่") in the master-data manager.
  const listings = await getListings();
  const propertyTypeUsage: Record<string, number> = {};
  for (const l of listings) {
    if (!l.property_type) continue;
    propertyTypeUsage[l.property_type] = (propertyTypeUsage[l.property_type] ?? 0) + 1;
  }

  const [accounts, employees, zones, actionTypes] = await Promise.all([
    getAccounts(),
    getEmployees(),
    getZones(),
    getActionTypes(),
  ]);

  return (
    <>
      <Topbar title="ตั้งค่า" subtitle="ผู้ใช้ · สิทธิ์ · ข้อมูลอ้างอิงกลาง" actions={false} />
      <div className="p-4 lg:p-6">
        <SettingsView
          zones={zones}
          propertyTypeUsage={propertyTypeUsage}
          accounts={accounts}
          employees={employees}
          actionTypes={actionTypes}
        />
      </div>
    </>
  );
}
