"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, MapPin, Home, Layers, ThumbsUp, ThumbsDown } from "lucide-react";
import { type Project, projectCompleteness } from "@/lib/projects";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import { cn } from "@/lib/cn";

export function ProjectsBrowser({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [zone, setZone] = React.useState<"all" | string>("all");

  const zones = React.useMemo(
    () => Array.from(new Set(projects.map((p) => p.zone).filter(Boolean))) as string[],
    [projects]
  );

  const query = q.trim().toLowerCase();
  const list = projects
    .filter((p) => zone === "all" || p.zone === zone)
    .filter(
      (p) =>
        !query ||
        p.name_eng.toLowerCase().includes(query) ||
        p.name_thai.toLowerCase().includes(query)
    );

  const chips: { key: "all" | string; label: string }[] = [
    { key: "all", label: "ทั้งหมด" },
    ...zones.map((z) => ({ key: z, label: z })),
  ];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <div className="relative w-full sm:w-auto">
          <Search
            size={14}
            strokeWidth={1.75}
            className="text-text-subtle absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหาชื่อโครงการ…"
            className="w-full sm:w-72 pl-8"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap ml-auto">
          {chips.map((c) => {
            const n =
              c.key === "all" ? projects.length : projects.filter((p) => p.zone === c.key).length;
            return (
              <button
                key={c.key}
                onClick={() => setZone(c.key)}
                className={cn(
                  "text-small font-medium rounded-md px-3 py-1.5 border transition-colors",
                  zone === c.key
                    ? "bg-text text-background border-text"
                    : "border-border-strong text-text-muted hover:bg-surface-2"
                )}
              >
                {c.label} <span className="num">({n})</span>
              </button>
            );
          })}
        </div>
      </div>

      {list.length === 0 ? (
        <Card className="p-10 text-center text-small text-text-subtle">ไม่พบโครงการ</Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => (
            <ProjectCard key={p.id} project={p} onClick={() => router.push(`/projects/${p.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project: p, onClick }: { project: Project; onClick: () => void }) {
  const pct = projectCompleteness(p);
  return (
    <Card
      onClick={onClick}
      className="p-4 cursor-pointer hover:border-border-strong transition-colors flex flex-col gap-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-body font-semibold truncate">{p.name_thai}</div>
          <div className="text-small text-text-subtle truncate">{p.name_eng}</div>
        </div>
        <Completeness pct={pct} />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-small text-text-muted">
        {p.zone && (
          <span className="inline-flex items-center gap-1">
            <MapPin size={12} strokeWidth={1.75} className="text-text-subtle" />
            {p.zone}
          </span>
        )}
        {p.property_type && (
          <span className="inline-flex items-center gap-1">
            <Home size={12} strokeWidth={1.75} className="text-text-subtle" />
            {p.property_type}
          </span>
        )}
        {p.units && (
          <span className="inline-flex items-center gap-1">
            <Layers size={12} strokeWidth={1.75} className="text-text-subtle" />
            {p.units}
          </span>
        )}
      </div>

      {(p.pros || p.cons) && (
        <div className="flex flex-col gap-1 text-small border-t border-border pt-2.5">
          {p.pros && (
            <div className="flex items-start gap-1.5">
              <ThumbsUp size={12} strokeWidth={1.75} className="text-green mt-0.5 shrink-0" />
              <span className="text-text-muted line-clamp-1">{p.pros}</span>
            </div>
          )}
          {p.cons && (
            <div className="flex items-start gap-1.5">
              <ThumbsDown size={12} strokeWidth={1.75} className="text-red mt-0.5 shrink-0" />
              <span className="text-text-muted line-clamp-1">{p.cons}</span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function Completeness({ pct }: { pct: number }) {
  const tone = pct >= 70 ? "green" : pct >= 30 ? "amber" : "neutral";
  return (
    <Pill tone={tone}>
      <span className="num">{pct}%</span>
    </Pill>
  );
}
