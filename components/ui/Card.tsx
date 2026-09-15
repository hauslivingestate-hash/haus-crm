import { cn } from "@/lib/cn";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("bg-surface border border-border rounded-lg shadow-card", className)}
      {...props}
    />
  );
}

/* No divider under the header: the title sits inside the card's padding, and the content
   that follows pulls up to it (CardContent's sibling rule) so the pair reads as one block
   rather than a titled box. Fixed h-12, because several headers put a toggle or a button
   on the right and they must line up across cards in a row. */
export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-card-header=""
      className={cn("flex items-center justify-between gap-3 px-5 h-12", className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-h2", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  // `[[data-card-header]+&]:pt-2` — only when it directly follows a CardHeader. A card
  // with no header keeps the full top padding.
  return <div className={cn("p-5 [[data-card-header]+&]:pt-2", className)} {...props} />;
}
