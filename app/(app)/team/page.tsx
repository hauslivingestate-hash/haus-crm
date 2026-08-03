import { Topbar } from "@/components/Topbar";
import { TeamTable } from "@/components/TeamTable";

export default function TeamPage() {
  return (
    <>
      <Topbar title="ทีม / บุคคล" subtitle="พนักงาน บทบาท และการจ้างงาน" actions={false} />
      <div className="p-4 lg:p-6">
        <TeamTable />
      </div>
    </>
  );
}
