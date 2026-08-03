import { Topbar } from "@/components/Topbar";
import { SettingsView } from "@/components/SettingsView";
import { listZones } from "@/lib/zones";
import { getListings } from "@/lib/queries";

export default async function SettingsPage() {
  const zones = listZones();

  // Live usage per property type (v_main_listing) — powers the delete-confirm impact line
  // ("มี N ทรัพย์ที่ใช้ค่านี้อยู่") in the master-data manager.
  const listings = await getListings();
  const propertyTypeUsage: Record<string, number> = {};
  for (const l of listings) {
    if (!l.property_type) continue;
    propertyTypeUsage[l.property_type] = (propertyTypeUsage[l.property_type] ?? 0) + 1;
  }

  return (
    <>
      <Topbar title="ตั้งค่า" subtitle="ผู้ใช้ · สิทธิ์ · ข้อมูลอ้างอิงกลาง" actions={false} />
      <div className="p-4 lg:p-6">
        <SettingsView zones={zones} propertyTypeUsage={propertyTypeUsage} />
      </div>
    </>
  );
}
