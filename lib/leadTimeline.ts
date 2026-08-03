// SAMPLE lead activity timeline — "what the assigned sales logged" on a lead, so admin has
// context when reassigning. Design-first + deterministic (seeded by lead_id). Wire: read the
// real activities (related_lead_id) + audit_log for the lead instead of generating these.
// Reassign events are NOT here — they come live from NewLeadsProvider.historyOf(leadId).

export type TimelineKind = "created" | "call" | "follow" | "show" | "note" | "stage" | "assign";

export interface TimelineEvent {
  id: string;
  kind: TimelineKind;
  at: string; // YYYY-MM-DD
  by: string; // actor nickname
  text: string;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const SCRIPT: { kind: TimelineKind; text: string }[] = [
  { kind: "call", text: "โทรหาลูกค้า แนะนำตัวและสอบถามความต้องการ" },
  { kind: "note", text: "สรุปความต้องการ: งบ/ทำเล/ประเภททรัพย์" },
  { kind: "show", text: "นัดชมทรัพย์ที่สนใจ" },
  { kind: "follow", text: "ตามผลหลังพาชม ลูกค้าขอเวลาตัดสินใจ" },
  { kind: "call", text: "โทรตามความคืบหน้า" },
  { kind: "stage", text: "ขยับสเตจ: กำลังต่อรอง" },
];

/** Deterministic sample of the assigned sales' logged activity for a lead. */
export function sampleTimeline(leadId: string, sale: string, dateReceived: string | null): TimelineEvent[] {
  const base = dateReceived || "2026-07-01";
  const h = hash(leadId);
  const count = 2 + (h % 4); // 2–5 logged events
  const events: TimelineEvent[] = [
    { id: `${leadId}-created`, kind: "created", at: base, by: sale || "Admin", text: sale ? `รับลีดเข้าระบบ · มอบหมายให้ ${sale}` : "รับลีดเข้าระบบ" },
  ];
  let day = 1;
  for (let i = 0; i < count; i++) {
    const s = SCRIPT[(h >> (i + 1)) % SCRIPT.length];
    day += 1 + ((h >> (i * 2)) % 3);
    events.push({ id: `${leadId}-a${i}`, kind: s.kind, at: addDays(base, day), by: sale || "—", text: s.text });
  }
  return events;
}
