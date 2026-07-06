import { Button } from "./ui/Button";

export function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="h-14 shrink-0 border-b border-border bg-surface/80 backdrop-blur flex items-center justify-between px-6 sticky top-0 z-10">
      <div>
        <h1 className="text-h1">{title}</h1>
        {subtitle && <p className="text-small text-text-muted -mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm">
          ส่งออก
        </Button>
        <Button size="sm">+ เพิ่มรายการ</Button>
      </div>
    </header>
  );
}
