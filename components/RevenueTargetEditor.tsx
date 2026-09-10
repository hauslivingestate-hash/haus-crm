import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { RevenueTargetForm } from "@/components/dashboard/RevenueTargetForm";

/* เป้ารายได้ on an employee's record — where a leader sets a SALE's number.
 *
 * The dashboard's own card carries the same form inline, but that one can only ever edit
 * the signed-in person's targets. Ben's requirement is that the CEO sets the sale's
 * figure, and the employee record is where a leader already opens a specific person.
 *
 * Shown only to `targets.set` holders, and never on your own record — setting your own
 * official number from a page meant for reviewing someone else is the exact thing this
 * split exists to prevent.
 */
export function RevenueTargetEditor({
  employeeCode,
  nickname,
  standing,
}: {
  employeeCode: string;
  nickname: string;
  standing: Record<string, number>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>เป้ารายได้ของ {nickname}</CardTitle>
      </CardHeader>
      <CardContent>
        <RevenueTargetForm employeeCode={employeeCode} standing={standing} />
        <p className="mt-3 text-small text-text-subtle">
          {nickname} จะเห็นแถบความคืบหน้าบนแดชบอร์ดของตัวเอง แต่แก้ตัวเลขเองไม่ได้ · ความคืบหน้านับจากคอมมิชชั่นของดีลที่เซ็นสัญญาในช่วงนั้น
          และไม่นับลีดที่สถานะเป็น Lose / Reject
        </p>
      </CardContent>
    </Card>
  );
}
