import { Topbar } from "@/components/Topbar";
import { DailyPlan } from "@/components/DailyPlan";
import { TargetsBoard } from "@/components/TargetsBoard";
import { getPlanData } from "@/lib/plan";

// The plan belongs to ONE person: whoever is signed in. Phase 5 #6 replaced the design
// build's hardcoded `currentAgent()` ("Stone") and stubbed TODAY with the session's
// employee_code and the real clock, so what this page shows is what the DB holds for them.

export default async function TodayPage() {
  const plan = await getPlanData();

  if (!plan) {
    return (
      <div className="plan-theme flex-1 flex flex-col">
        <Topbar title="แผนวันนี้" actions={false} />
        <div className="p-6 text-body text-text-muted">
          บัญชีนี้ยังไม่ได้ผูกกับข้อมูลพนักงาน จึงยังไม่มีแผนงาน — ติดต่อผู้ดูแลระบบ
        </div>
      </div>
    );
  }

  return (
    // .plan-theme scopes the Solo Gang "Momentum" palette to this page only (globals.css).
    <div className="plan-theme flex-1 flex flex-col">
      <Topbar title="แผนวันนี้" subtitle={`แผนงานและเป้าหมายของ ${plan.nickname}`} actions={false} />
      <div className="p-4 lg:p-6 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 items-start">
          <DailyPlan plan={plan} />
          <TargetsBoard plan={plan} />
        </div>
      </div>
    </div>
  );
}
