import Link from "next/link";
import { ArrowRight, CalendarCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { RingProgress } from "@/components/ui/RingProgress";
import type { TodaySummary } from "@/lib/salesDashboard";

/* แผนวันนี้ — a pointer, not a second planner.
 *
 * The real thing lives at /today: a client island with optimistic ticking, task
 * composition, repeats and the leave form. Rendering a copy of it here would give the
 * company two surfaces that can disagree about whether a task is done, and would double
 * the cost of every future change to it. Klaichan embeds its planner because Klaichan
 * has nowhere else to put it.
 *
 * So this shows the one fact worth seeing from across the room — how much of today is
 * done — and gets out of the way.
 */
export function TodayCard({ summary }: { summary: TodaySummary }) {
  const { done, total } = summary;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        {total > 0 ? (
          <RingProgress pct={pct} size={48} />
        ) : (
          <div className="grid size-12 shrink-0 place-items-center rounded-full bg-surface-2">
            <CalendarCheck size={20} strokeWidth={1.75} className="text-text-subtle" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="text-h2">แผนวันนี้</div>
          <p className="text-small text-text-muted">
            {total > 0
              ? `ทำแล้ว ${done} จาก ${total} งาน`
              : "ยังไม่มีงานในแผนวันนี้ — เพิ่มได้ที่หน้าแผนวันนี้"}
          </p>
        </div>

        <Link
          href="/today"
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1.5 text-small text-text-muted hover:bg-surface-hover hover:text-text transition-colors"
        >
          เปิดแผน
          <ArrowRight size={14} strokeWidth={1.75} />
        </Link>
      </CardContent>
    </Card>
  );
}
