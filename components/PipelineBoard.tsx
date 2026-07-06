import { STAGES } from "@/lib/pipeline";
import { CrmRow } from "@/lib/queries";
import { formatBaht } from "@/lib/format";
import { Dot } from "./ui/Dot";
import { GradeChip } from "./ui/GradeChip";
import { Avatar } from "./ui/Avatar";

// Hairline-divided stage columns (not floating kanban).
export function PipelineBoard({ rows }: { rows: CrmRow[] }) {
  // Only show active deals in the board; Win/Lose live in reports.
  const active = rows.filter((r) => r.lead_status === "Active");
  const byStage = (key: string) => active.filter((r) => r.pipeline_stage === key);

  return (
    <div className="w-full overflow-x-auto scroll-thin">
      <div className="flex min-w-max border border-border rounded-lg bg-surface divide-x divide-border">
        {STAGES.filter((s) => s.key !== "Close" && s.key !== "Win").map((stage) => {
          const cards = byStage(stage.key);
          const sum = cards.reduce((a, c) => a + (c.budget ?? 0), 0);
          return (
            <div key={stage.key} className="w-[220px] shrink-0">
              <div className="flex items-center justify-between gap-2 px-3 h-11 border-b border-border">
                <span className="inline-flex items-center gap-1.5 text-h3">
                  <Dot className={stage.dot} />
                  {stage.th}
                </span>
                <span className="text-label num text-text-subtle">{cards.length}</span>
              </div>
              <div className="p-2 space-y-2 min-h-[120px]">
                {cards.map((c) => (
                  <div
                    key={c.lead_id}
                    className="rounded-md border border-border bg-surface p-2.5 hover:border-border-strong transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-body font-medium truncate">{c.lead_name}</span>
                      <GradeChip grade={c.potential ?? ""} />
                    </div>
                    <div className="mt-1.5 text-h3 num text-accent">{formatBaht(c.budget)}</div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-label text-text-subtle num">{c.listing_code ?? "—"}</span>
                      <Avatar name={c.sale_id ?? ""} tone="crimson" className="h-5 w-5" />
                    </div>
                  </div>
                ))}
                {cards.length === 0 && (
                  <div className="text-small text-text-subtle text-center py-4">—</div>
                )}
              </div>
              <div className="px-3 h-9 flex items-center border-t border-border text-label text-text-muted num">
                {formatBaht(sum)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
