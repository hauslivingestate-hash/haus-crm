import { Topbar } from "@/components/Topbar";
import { LeaveBoard } from "@/components/LeaveBoard";

// วันลา — HR's leave surface. Source: HR Sheet → `Day off` tab.
// Everyone reaches this page; scoping happens inside LeaveBoard (own vs. all), because the
// viewer's permissions are client-side. Requests are filed from แผนวันนี้.
export const revalidate = 30;

export default function LeavePage() {
  return (
    <>
      <Topbar title="วันลา" subtitle="ใบลาและการอนุมัติ" actions={false} />
      <div className="p-4 lg:p-6">
        <LeaveBoard />
      </div>
    </>
  );
}
