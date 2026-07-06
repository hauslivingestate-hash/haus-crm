// Maps DB pipeline_stage (main_6_buyer_crm) -> Thai display + vivid stage dot token.
// DB stages: Lead | Call | Follow | Appoint | Show | Nego | Close | Win

export type StageKey =
  | "Lead" | "Call" | "Follow" | "Appoint" | "Show" | "Nego" | "Close" | "Win";

export interface StageMeta {
  key: StageKey;
  th: string;
  dot: string; // tailwind bg-* token utility
}

export const STAGES: StageMeta[] = [
  { key: "Lead",    th: "ใหม่",          dot: "bg-dot-blue" },
  { key: "Call",    th: "ติดต่อแล้ว",     dot: "bg-dot-teal" },
  { key: "Follow",  th: "ติดตาม",         dot: "bg-dot-violet" },
  { key: "Appoint", th: "นัดหมาย",        dot: "bg-dot-violet" },
  { key: "Show",    th: "พาชม",           dot: "bg-dot-amber" },
  { key: "Nego",    th: "เจรจาต่อรอง",    dot: "bg-dot-crimson" },
  { key: "Close",   th: "ปิดการขาย",      dot: "bg-dot-green" },
  { key: "Win",     th: "ปิดได้",         dot: "bg-dot-green" },
];

export const STAGE_MAP: Record<string, StageMeta> = Object.fromEntries(
  STAGES.map((s) => [s.key, s])
);

export function stageMeta(key: string | null | undefined): StageMeta {
  return (key && STAGE_MAP[key]) || { key: "Lead", th: key || "—", dot: "bg-text-subtle" } as StageMeta;
}
