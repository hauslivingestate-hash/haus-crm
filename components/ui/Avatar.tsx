import { cn } from "@/lib/cn";

export function Avatar({
  name,
  tone = "neutral",
  className,
}: {
  name: string | null | undefined;
  tone?: "crimson" | "neutral";
  className?: string;
}) {
  const initials = (name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
  return (
    <span
      className={cn(
        "inline-flex h-6 w-6 items-center justify-center rounded-full text-label shrink-0",
        tone === "crimson"
          ? "bg-accent-wash text-accent"
          : "bg-surface-2 text-text-muted border border-border",
        className
      )}
    >
      {initials}
    </span>
  );
}
