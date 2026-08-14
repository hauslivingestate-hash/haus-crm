import { Topbar } from "@/components/Topbar";
import { TeamTable } from "@/components/TeamTable";
import { getEmployees } from "@/lib/queries";

export default async function TeamPage() {
  const employees = await getEmployees();

  return (
    <>
      <Topbar title="ทีม / บุคคล" subtitle="พนักงาน บทบาท และการจ้างงาน" actions={false} />
      <div className="p-4 lg:p-6">
        <TeamTable employees={employees} />
      </div>
    </>
  );
}
