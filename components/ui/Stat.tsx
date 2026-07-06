import { cn } from "@/lib/cn";
import { Card } from "./Card";

export function Stat({
  label,
  value,
  delta,
  hint,
  className,
}: {
  label: string;
  value: React.ReactNode;
  delta?: { value: string; positive?: boolean };
  hint?: string;
  className?: string;
}) {
  return (
    <Card className={cn("p-4", className)}>
      <div className="text-label uppercase text-text-subtle">{label}</div>
      <div className="mt-2 flex items-end gap-2">
        <div className="text-display num leading-none">{value}</div>
        {delta && (
          <span
            className={cn(
              "text-small num mb-0.5",
              delta.positive === false ? "text-red" : "text-green"
            )}
          >
            {delta.positive === false ? "▾" : "▴"} {delta.value}
          </span>
        )}
      </div>
      {hint && <div className="mt-1 text-small text-text-muted">{hint}</div>}
    </Card>
  );
}
