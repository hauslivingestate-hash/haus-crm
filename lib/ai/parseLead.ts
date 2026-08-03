// Paste-to-parse for lead intake — DESIGN-FIRST STUB. The reference (Shelter CRM) is a real
// OpenAI gpt-4.1 server action with a strict JSON schema; this mirrors its CONTRACT exactly
// ({ ok, note, draft } · nullable-everything · "return null, never guess" · enum-locked
// fields) but extracts heuristically (regex/keywords) so no API key / server action / dep is
// needed yet. Wiring = replace the body of `parseLeadText` with the OpenAI call; the UI
// (AiPasteBox) and the form's onFilled handler don't change. See DATA_MODEL.

import { LEAD_SOURCES, PROPERTY_TYPES, SAMPLE_INTEREST_LISTINGS, type LeadRole, type LeadSource } from "@/lib/leads";

// Nullable-everything (strict-schema convention): absent = null, never a guess.
export interface LeadDraft {
  role: LeadRole | null;
  lead_name: string | null;
  phone: string | null;
  source: LeadSource | null;
  budget: number | null;
  propertyType: string | null;
  zone: string | null;
}

export type ParseResult =
  | { ok: true; note: string; draft: LeadDraft }
  | { ok: false; error: string };

const HONORIFICS = /^(คุณ|นาย|นาง(?:สาว)?|น\.ส\.|เจ๊|พี่|K\.?|Khun|Mr\.?|Ms\.?|Mrs\.?)\s*/i;

/** Thai-number-aware baht parse: "3.5 ล้าน" → 3500000, "5 แสน" → 500000, "3,500,000" → 3500000. */
function parseBaht(text: string): number | null {
  const m = text.match(/(\d[\d,\.]*)\s*(ล้าน|แสน|หมื่น|พัน)?/);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  if (!isFinite(n) || n <= 0) return null;
  const mult = m[2] === "ล้าน" ? 1_000_000 : m[2] === "แสน" ? 100_000 : m[2] === "หมื่น" ? 10_000 : m[2] === "พัน" ? 1_000 : 1;
  return Math.round(n * mult);
}

function extractPhone(raw: string): string | null {
  // Thai mobile / landline: 9–10 digits, optionally spaced/dashed.
  const m = raw.replace(/[^\d\s-]/g, " ").match(/(0\d[\d\s-]{7,10}\d)/);
  if (!m) return null;
  const digits = m[1].replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 10 ? digits : null;
}

function extractName(raw: string): string | null {
  // "ชื่อ X" / "คุณ X" on the first matching line; strip honorifics.
  const nameLine = raw.match(/(?:ชื่อ|ลูกค้า|เจ้าของ)\s*[:：]?\s*(.+)/);
  if (nameLine) {
    const first = nameLine[1].split(/[\n,·|]/)[0].trim().replace(HONORIFICS, "").trim();
    if (first) return first.split(/\s{2,}/)[0].slice(0, 40) || null;
  }
  const khun = raw.match(/คุณ\s*([^\s\d,·|\n]{1,20})/);
  if (khun) return khun[1].trim() || null;
  return null;
}

const containsAny = (raw: string, words: string[]) => words.some((w) => raw.includes(w));

export function parseLeadTextSync(raw: string): ParseResult {
  const text = raw.trim();
  if (!text) return { ok: false, error: "วางข้อความก่อน" };
  if (text.length < 6) return { ok: false, error: "ข้อความสั้นเกินไป — วางบทสนทนา/ข้อความลูกค้า" };

  const role: LeadRole | null = containsAny(text, ["ขาย", "เจ้าของ", "ฝากขาย", "ปล่อยเช่าห้อง", "มีห้อง"])
    ? "owner"
    : containsAny(text, ["หา", "ซื้อ", "อยากได้", "สนใจ", "เช่า", "งบ"])
      ? "buyer"
      : null;

  const source: LeadSource | null =
    containsAny(text, ["line", "ไลน์"]) ? "line"
    : containsAny(text, ["facebook", "เฟส", "fb", "เพจ"]) ? "facebook"
    : containsAny(text, ["ddproperty", "ดีดี"]) ? "ddproperty"
    : containsAny(text, ["livinginsider", "ลิฟวิ่ง"]) ? "livinginsider"
    : containsAny(text, ["ป้าย", "offline"]) ? "offline"
    : containsAny(text, ["เว็บ", "website", "เว็บไซต์"]) ? "website"
    : containsAny(text, ["walk", "เดินเข้า"]) ? "walkin"
    : containsAny(text, ["แนะนำ", "บอกต่อ", "referral"]) ? "referral"
    : null;

  const propertyType = PROPERTY_TYPES.find((t) => text.includes(t)) ?? (text.includes("บ้าน") ? "บ้านเดี่ยว" : null);
  const zone = [...new Set(SAMPLE_INTEREST_LISTINGS.map((l) => l.zone))].find((z) => text.includes(z)) ?? null;

  const budgetM = text.match(/(?:งบ|ราคา|ประมาณ|budget)\s*[:：]?\s*([\d,\.]+\s*(?:ล้าน|แสน|หมื่น|พัน)?)/i);
  const budget = budgetM ? parseBaht(budgetM[1]) : null;

  const draft: LeadDraft = {
    role,
    lead_name: extractName(text),
    phone: extractPhone(text),
    source,
    budget,
    propertyType,
    zone,
  };

  const found = Object.entries({
    ชื่อ: draft.lead_name,
    เบอร์: draft.phone,
    ช่องทาง: draft.source && LEAD_SOURCES.find((s) => s.id === draft.source)?.label,
    งบ: draft.budget,
    ประเภท: draft.propertyType,
    ทำเล: draft.zone,
  })
    .filter(([, v]) => v != null && v !== "")
    .map(([k]) => k);

  // Stubbed contact dedupe note (the real action matches phone against contacts).
  const note = found.length
    ? `อ่านได้: ${found.join(" · ")} — ตรวจทานแล้วบันทึกได้เลย`
    : "อ่านรายละเอียดไม่ได้ชัดเจน — กรอกด้วยตนเอง";

  return { ok: true, note, draft };
}

/** Async wrapper (mirrors the server-action signature the real OpenAI parser will use). */
export async function parseLeadText(raw: string): Promise<ParseResult> {
  await new Promise((r) => setTimeout(r, 550)); // mimic the round-trip so the busy state shows
  return parseLeadTextSync(raw);
}

export const LEAD_PARSE_HINTS = [
  "ชื่อลูกค้า/เจ้าของ และเบอร์โทร (เช่น คุณเบิร์ด 081-234-5678)",
  "งบหรือราคา — พิมพ์เป็น “3.5 ล้าน” หรือ “฿3,500,000” ก็ได้",
  "ทำเล/โครงการ · ประเภททรัพย์ (คอนโด/บ้าน) · จำนวนห้องนอน",
  "ช่องทางที่ติดต่อมา (LINE / โทร / Facebook)",
];
