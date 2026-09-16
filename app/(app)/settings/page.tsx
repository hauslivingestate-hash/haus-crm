import { Topbar } from "@/components/Topbar";
import { SettingsView } from "@/components/SettingsView";
import { getColorableLists } from "@/lib/tables/colors";
import { getListings, getEmployees, getZones, getActionTypes, getActionUsage, getPropertyTypeCodes, getRbacConfig, getTeams, getKpiTemplates, getChecklistTemplates, getRoleOptions } from "@/lib/queries";
import { getAccounts } from "@/lib/accounts";

export default async function SettingsPage({
  searchParams,
}: {
  // `?tab=accounts|roles|teams` — followed from the "ยังตั้งค่าไม่ครบ" checklist on a ทีม
  // record. Read here rather than with useSearchParams() so SettingsView needs no Suspense
  // boundary; this page is already dynamic (it reads cookies through Supabase).
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  // Live usage per property type (v_main_listing) — powers the delete-confirm impact line
  // ("มี N ทรัพย์ที่ใช้ค่านี้อยู่") in the master-data manager.
  const listings = await getListings();
  const propertyTypeUsage: Record<string, number> = {};
  for (const l of listings) {
    if (!l.property_type) continue;
    propertyTypeUsage[l.property_type] = (propertyTypeUsage[l.property_type] ?? 0) + 1;
  }

  const [accounts, employees, zones, actionTypes, actionUsage, propertyTypeCodes, rbac, teams, kpiTemplates, checklistTemplates, roleOptions, colorLists] =
    await Promise.all([
    getAccounts(),
    getEmployees(),
    getZones(),
    getActionTypes(),
    getActionUsage(),
    getPropertyTypeCodes(),
    getRbacConfig(),
    getTeams(),
    getKpiTemplates(),
    getChecklistTemplates(),
    getRoleOptions(),
    getColorableLists(),
  ]);

  return (
    <>
      <Topbar title="ตั้งค่า" subtitle="ผู้ใช้ · สิทธิ์ · ข้อมูลอ้างอิงกลาง" actions={false} />
      <div className="p-4 lg:p-6">
        <SettingsView
          initialSection={tab}
          colorLists={colorLists}
          zones={zones}
          propertyTypeUsage={propertyTypeUsage}
          accounts={accounts}
          employees={employees}
          actionTypes={actionTypes}
          actionUsage={actionUsage}
          propertyTypeCodes={propertyTypeCodes}
          rbac={rbac}
          teams={teams}
          kpiTemplates={kpiTemplates}
          checklistTemplates={checklistTemplates}
          roleOptions={roleOptions}
        />
      </div>
    </>
  );
}
