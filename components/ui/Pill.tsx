import { cn } from "@/lib/cn";

// Soft filled chip — counts / emphasis only.
export function Pill({
  className,
  tone = "neutral",
  children,
}: {
  className?: string;
  tone?: "neutral" | "accent" | "green" | "amber" | "blue" | "red";
  children: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-surface-2 text-text-muted",
    accent: "bg-accent-wash text-accent",
    green: "bg-green-bg text-green",
    amber: "bg-amber-bg text-amber",
    blue: "bg-blue-bg text-blue",
    red: "bg-red-bg text-red",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-1.5 h-5 text-label",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
