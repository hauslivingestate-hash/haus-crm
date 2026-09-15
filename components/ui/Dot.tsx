import { cn } from "@/lib/cn";

export function Dot({ className }: { className?: string }) {
  return <span className={cn("inline-block h-2 w-2 rounded-full shrink-0", className)} />;
}

/* Status = coloured dot in a NEUTRAL pill. The pill is grey, never tinted with the status
   hue: the hues come from the sheet palette and the stage maps, and a tinted background
   would need a text-safe partner for each of them. The dot carries the colour, the pill
   carries the shape. */
export function StatusBadge({
  color,
  children,
}: {
  color: string; // bg-* utility, e.g. "bg-green"
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full bg-surface-2 px-2 text-small text-text">
      <Dot className={color} />
      {children}
    </span>
  );
}
