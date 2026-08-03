import { cn } from "@/lib/cn";

export function Avatar({
  name,
  tone = "neutral",
  src,
  className,
}: {
  name: string | null | undefined;
  tone?: "crimson" | "neutral";
  /** Optional profile image; falls back to initials when absent or empty. */
  src?: string | null;
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
        "inline-flex h-6 w-6 items-center justify-center overflow-hidden rounded-full text-label shrink-0",
        src
          ? "bg-surface-2"
          : tone === "crimson"
            ? "bg-accent-wash text-accent"
            : "bg-surface-2 text-text-muted border border-border",
        className
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name || ""} className="h-full w-full object-cover" />
      ) : (
        initials
      )}
    </span>
  );
}
