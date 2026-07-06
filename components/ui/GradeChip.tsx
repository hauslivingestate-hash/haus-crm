import { cn } from "@/lib/cn";

// Solid A/B/C square chip. A gets a dark letter (white on gold is unreadable).
const MAP: Record<string, string> = {
  A: "bg-grade-a text-grade-a-ink",
  B: "bg-grade-b text-grade-b-ink",
  C: "bg-grade-c text-grade-c-ink",
};

export function GradeChip({ grade, className }: { grade: string; className?: string }) {
  const style = MAP[grade];
  if (!style) {
    return (
      <span className={cn("inline-flex items-center text-small text-text-muted", className)}>
        {grade}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex h-5 w-5 items-center justify-center rounded-[6px] text-small font-bold num",
        style,
        className
      )}
    >
      {grade}
    </span>
  );
}
