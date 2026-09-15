import type { LucideIcon } from "lucide-react";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { Card } from "./Card";

/* KPI tile: an icon in a tinted square, the label, a big number, and one line of
 * context beneath — a change against the previous period, or a hint.
 *
 * `delta.positive` is three-valued on purpose: true draws ▴ green, false ▾ red, and
 * undefined draws neither — "started from zero" is neither good nor bad, and a card
 * that paints it green is editorialising. */
export function Stat({
  label,
  value,
  delta,
  hint,
  icon: Icon,
  help,
  className,
}: {
  label: string;
  value: React.ReactNode;
  delta?: { value: string; positive?: boolean; label?: string };
  hint?: string;
  icon?: LucideIcon;
  /** Shown as a tooltip on a ? — what the number counts, for when the label cannot say. */
  help?: string;
  className?: string;
}) {
  return (
    <Card className={cn("p-5", className)}>
      <div className="flex items-center gap-2">
        {Icon && (
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-accent-wash text-accent">
            <Icon size={15} strokeWidth={1.75} />
          </span>
        )}
        <span className="min-w-0 truncate text-small text-text-muted">{label}</span>
        {help && (
          <span title={help} className="ml-auto shrink-0 text-text-subtle" aria-label={help}>
            <HelpCircle size={14} strokeWidth={1.75} />
          </span>
        )}
      </div>
      <div className="mt-3 text-display leading-none tracking-tight">{value}</div>
      {delta && (
        <div className="mt-2 flex items-baseline gap-1 text-small">
          <span
            className={cn(
              "num font-semibold",
              delta.positive === true && "text-green",
              delta.positive === false && "text-red",
              delta.positive === undefined && "text-text-muted"
            )}
          >
            {delta.positive === true ? "▴ " : delta.positive === false ? "▾ " : ""}
            {delta.value}
          </span>
          {delta.label && <span className="truncate text-text-subtle">{delta.label}</span>}
        </div>
      )}
      {hint && !delta && <div className="mt-2 truncate text-small text-text-subtle">{hint}</div>}
    </Card>
  );
}
