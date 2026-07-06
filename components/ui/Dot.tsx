import { cn } from "@/lib/cn";

export function Dot({ className }: { className?: string }) {
  return <span className={cn("inline-block h-2 w-2 rounded-full shrink-0", className)} />;
}

// Status = colored dot + plain text (never a filled pill)
export function StatusBadge({
  color,
  children,
}: {
  color: string; // bg-* utility, e.g. "bg-green"
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-body whitespace-nowrap">
      <Dot className={color} />
      {children}
    </span>
  );
}
