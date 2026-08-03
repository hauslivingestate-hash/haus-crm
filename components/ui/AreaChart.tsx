"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

// Hand-built responsive SVG area chart (no chart dependency). Theme-aware via CSS vars
// (var(--color-accent) etc.), so it follows the app palette in light/dark. Optional goal
// reference line + hover guide/tooltip. Kept deliberately small — sparkline → full trend.
export function AreaChart({
  data,
  goal,
  goalLabel = "เป้า",
  height = 200,
  format = (n) => String(n),
  color = "var(--color-accent)",
  className,
}: {
  data: { label: string; value: number }[];
  goal?: number;
  goalLabel?: string;
  height?: number;
  format?: (n: number) => string;
  /** Stroke/fill colour (defaults to the CRM accent; dashboard passes HAUS burgundy). */
  color?: string;
  className?: string;
}) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const [w, setW] = React.useState(600);
  const [hover, setHover] = React.useState<number | null>(null);

  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cw = entries[0]?.contentRect.width;
      if (cw) setW(Math.round(cw));
    });
    ro.observe(el);
    setW(Math.round(el.getBoundingClientRect().width) || 600);
    return () => ro.disconnect();
  }, []);

  const padX = 6;
  const padTop = 10;
  const axisH = 20; // room for x labels
  const plotH = height - axisH;
  const n = data.length;

  const maxVal = Math.max(goal ?? 0, ...data.map((d) => d.value), 1) * 1.12;
  const x = (i: number) => (n <= 1 ? padX : padX + (i * (w - padX * 2)) / (n - 1));
  const y = (v: number) => padTop + (1 - v / maxVal) * (plotH - padTop);

  const linePath = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(" ");
  const areaPath =
    n > 0
      ? `${linePath} L${x(n - 1).toFixed(1)},${plotH} L${x(0).toFixed(1)},${plotH} Z`
      : "";

  const gid = React.useId();

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (n === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(x(i) - mx);
      if (d < bestD) { bestD = d; best = i; }
    }
    setHover(best);
  };

  const hv = hover != null ? data[hover] : null;

  return (
    <div ref={wrapRef} className={cn("relative w-full", className)} style={{ height }}>
      <svg
        width={w}
        height={height}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        className="block absolute left-0 top-0"
        role="img"
        aria-label="กราฟแนวโน้ม"
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Goal reference line */}
        {goal != null && goal > 0 && (
          <g>
            <line
              x1={padX}
              x2={w - padX}
              y1={y(goal)}
              y2={y(goal)}
              stroke="var(--color-text-subtle)"
              strokeWidth={1}
              strokeDasharray="4 4"
              opacity={0.7}
            />
            <text x={w - padX} y={y(goal) - 4} textAnchor="end" fontSize={10} fill="var(--color-text-subtle)">
              {goalLabel}
            </text>
          </g>
        )}

        {areaPath && <path d={areaPath} fill={`url(#${gid})`} />}
        {linePath && <path d={linePath} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />}

        {/* Hover guide + dot */}
        {hv && (
          <g>
            <line x1={x(hover!)} x2={x(hover!)} y1={padTop} y2={plotH} stroke="var(--color-border-strong)" strokeWidth={1} />
            <circle cx={x(hover!)} cy={y(hv.value)} r={3.5} fill={color} stroke="var(--color-surface)" strokeWidth={1.5} />
          </g>
        )}

        {/* X-axis labels */}
        {data.map((d, i) => (
          <text
            key={d.label + i}
            x={x(i)}
            y={height - 6}
            textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
            fontSize={10}
            fill="var(--color-text-subtle)"
          >
            {d.label}
          </text>
        ))}
      </svg>

      {/* Tooltip */}
      {hv && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-md border border-border bg-surface px-2 py-1 shadow-pop"
          style={{ left: Math.min(Math.max(x(hover!), 40), w - 40), top: y(hv.value) - 6 }}
        >
          <div className="text-label text-text-subtle">{hv.label}</div>
          <div className="num text-small font-semibold">{format(hv.value)}</div>
        </div>
      )}
    </div>
  );
}
