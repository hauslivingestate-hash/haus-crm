import "server-only";
import OpenAI from "openai";
import { LISTING_FIELD_MAP, type ListingField, type ListingLookup } from "@/lib/listingFields";
// The tier and its price live in their own zero-import module so the ตั้งค่า ▸ AI panel can
// read them without dragging `server-only` and the OpenAI SDK into the browser bundle.
import { AI_MODEL } from "@/lib/ai/model";

/* Paste-to-form extraction. The model READS raw Thai text into a strict JSON schema.
 *
 * It does exactly one job and no more: turn prose into fields. It never decides record
 * matching (zone → zone_id, a project name → a project row, a KC code → a real listing) —
 * that is deterministic code in lib/ai/parse.ts, because Klaichan's measured finding was
 * that the model mismatches records about a fifth of the time. And it never saves: the form
 * pre-fills and a person reviews before บันทึก.
 *
 * ── WHY THE ENUMS ARE PASSED IN AND NOT FROZEN HERE ─────────────────────────────
 * The schema is what the model is ALLOWED to return. A marketing channel added in ตั้งค่า
 * could never be extracted from a pasted conversation until this list knew about it, and a
 * channel that was retired would keep being suggested. Every controlled vocabulary in this
 * app is a lookup TABLE (lib/lookups.ts), so every one of them is read per call.
 *
 * The model tier and its price are NOT here either — see lib/ai/model.ts for why.
 */

/** Thrown with a stable CODE, not a sentence. lib/ai/parse.ts maps it to Thai — keeping the
 *  wording out of here means one place to change what a user reads. */
export class AiError extends Error {}

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!process.env.OPENAI_API_KEY) throw new AiError("AI_KEY_MISSING");
  return (_client ??= new OpenAI());
}

/** Map an OpenAI SDK error to a stable code — is this worth retrying, waiting out, or
 *  telling an admin about? Those are three different messages. */
function classify(e: unknown): string {
  const err = e as { status?: number; code?: string; type?: string; name?: string };
  const status = err?.status;
  const code = err?.code ?? err?.type;
  if (status === 401 || status === 403) return "AI_BAD_KEY";
  if (status === 429) return code === "insufficient_quota" ? "AI_NO_CREDIT" : "AI_RATE_LIMIT";
  if (typeof status === "number" && status >= 500) return "AI_UNAVAILABLE";
  if (err?.name === "APIConnectionError" || err?.name === "APIConnectionTimeoutError") {
    return "AI_UNAVAILABLE";
  }
  return "AI_REQUEST_FAILED";
}

/* ── strict-mode schema helpers ───────────────────────────────────────────────────
   OpenAI strict mode requires EVERY property to be listed in `required`, so "absent" is
   expressed as an allowed null rather than an omitted key. An enum therefore has to carry
   null as one of its members. */

const nullableString = (values?: string[]) =>
  values && values.length
    ? { type: ["string", "null"], enum: [...values, null] }
    : { type: ["string", "null"] };

const nullableNumber = (kind: "number" | "integer") => ({ type: [kind, "null"] });

export type Usage = { model: string; inputTokens: number; outputTokens: number };

/** Run one strict-JSON-schema extraction. Returns the parsed object and the token cost. */
async function extract<T>(
  schemaName: string,
  properties: Record<string, unknown>,
  system: string,
  raw: string
): Promise<{ data: T; usage: Usage }> {
  let completion;
  try {
    completion = await client().chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: raw },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: schemaName,
          strict: true,
          schema: {
            type: "object",
            properties,
            required: Object.keys(properties),
            additionalProperties: false,
          },
        },
      },
    });
  } catch (e) {
    if (e instanceof AiError) throw e;
    throw new AiError(classify(e));
  }

  const msg = completion.choices[0]?.message;
  if (msg?.refusal) throw new AiError("AI_REFUSED");
  if (!msg?.content) throw new AiError("AI_EMPTY");

  let data: T;
  try {
    data = JSON.parse(msg.content) as T;
  } catch {
    throw new AiError("AI_BAD_JSON");
  }

  return {
    data,
    usage: {
      model: completion.model || AI_MODEL,
      inputTokens: completion.usage?.prompt_tokens ?? 0,
      outputTokens: completion.usage?.completion_tokens ?? 0,
    },
  };
}

/** Every prompt ends with this. Thai money words are the single most common thing a
 *  general-purpose extractor gets wrong on this data. */
const THAI_NUMBERS =
  "แปลงจำนวนเงินภาษาไทยเป็นตัวเลขบาทเสมอ: ล้าน = 1,000,000 · แสน = 100,000 · หมื่น = 10,000 · พัน = 1,000 " +
  '(เช่น "5.9 ล้าน" → 5900000, "3 แสน 5" → 350000) ตัดเครื่องหมายจุลภาคออก ' +
  "ถ้าไม่พบข้อมูลของช่องใด ให้ตอบ null — ห้ามเดาหรือแต่งขึ้นเอง";

/* ── LEAD ─────────────────────────────────────────────────────────────────────── */

/** The live vocabularies a lead may be filed against — every one of them a lookup table.
 *  `zones` holds the THAI NAMES (อโศก), not zone_ids: a model asked to pick "ASK" from a
 *  conversation that says "อโศก" is being asked to do the join, which is parse.ts's job. */
export interface LeadEnums {
  leadTypes: string[];
  channels: string[];
  contactBys: string[];
  genders: string[];
  nationalities: string[];
  propertyTypes: string[];
  purposes: string[];
  sellReasons: string[];
  zones: string[];
}

/** What the model returns for a lead. Raw — zone is still a Thai name here. */
export type RawLeadDraft = {
  lead_name: string | null;
  phone: string | null;
  line_id: string | null;
  lead_type: string | null;
  marketing_channel: string | null;
  contact_by: string | null;
  gender: string | null;
  nationality: string | null;
  budget: number | null;
  interest_zone: string | null;
  interest_property_type: string | null;
  purpose: string | null;
  sell_reason: string | null;
  listing_code: string | null;
  remark: string | null;
};

export async function extractLead(
  raw: string,
  enums: LeadEnums
): Promise<{ draft: RawLeadDraft; usage: Usage }> {
  const system =
    "คุณคือผู้ช่วยกรอกข้อมูลลีด (lead) ให้ทีมขายอสังหาฯ ดึงข้อมูลจากข้อความดิบที่ผู้ใช้วางมา " +
    "(ภาษาไทย อาจเป็นข้อความสั้น ๆ หรือบทสนทนา LINE ทั้งบท) ลงในโครงสร้างที่กำหนด\n" +
    '- lead_name: ชื่อผู้ติดต่อ ตัดคำนำหน้าออก (คุณ/นาย/นาง/นางสาว/K./Mr./Ms.) เช่น "คุณสมชาย" → "สมชาย"\n' +
    "- phone: เบอร์โทร เก็บเฉพาะตัวเลข · line_id: LINE ID ถ้ามี\n" +
    // lead_type carries the buyer/owner axis, so it is described rather than left to a bare
    // enum: the labels are English and the conversation is Thai.
    `- lead_type: ประเภทลีด เลือกจาก (${enums.leadTypes.join(" / ")}) — ` +
    "ลูกค้าที่หาซื้อ = Buyer - Buy · หาเช่า = Buyer - Rent · เจ้าของที่จะฝากขาย = Owner - Sale · " +
    "เจ้าของที่จะปล่อยเช่า = Owner - Rent · นายหน้าด้วยกัน = Co-Agent\n" +
    "- marketing_channel: ช่องทางที่ลูกค้าติดต่อเข้ามา เลือกจากรายการที่กำหนดเท่านั้น ไม่ตรงให้ null\n" +
    "- contact_by: ช่องทาง/กล่องข้อความที่รับสายหรือรับแชทจริง เลือกจากรายการที่กำหนด\n" +
    "- gender / nationality: ระบุเฉพาะเมื่อข้อความบอกชัดเจน\n" +
    '- budget: งบประมาณหรือราคาที่ต้องการ เป็นตัวเลขบาทเต็ม (เช่น "6 ล้าน" → 6000000) ' +
    "ถ้าเป็นช่วง ให้เอาตัวเลขบนสุด\n" +
    "- interest_zone: ทำเลที่ลูกค้าอยากได้ (ไม่ใช่ที่อยู่ปัจจุบันของลูกค้า) เลือกจากรายการที่กำหนดเท่านั้น\n" +
    "- interest_property_type: ประเภททรัพย์ที่สนใจ เลือกจากรายการที่กำหนดเท่านั้น\n" +
    "- purpose: จุดประสงค์ของผู้ซื้อ/ผู้เช่า · sell_reason: เหตุผลที่เจ้าของอยากขาย — " +
    "กรอกเฉพาะฝั่งที่ตรงกับ lead_type เท่านั้น อีกฝั่งให้ null\n" +
    '- listing_code: รหัสทรัพย์ที่ลูกค้าถามถึง ถ้าระบุ (เช่น "CAS001")\n' +
    "- remark: สรุปสิ่งที่ลูกค้าต้องการและเงื่อนไขสำคัญ สั้น ๆ เป็นข้อ ๆ (ขึ้นบรรทัดใหม่ด้วย - ) " +
    "เอาเฉพาะที่พูดจริง ไม่มีให้ null\n" +
    THAI_NUMBERS;

  const { data, usage } = await extract<RawLeadDraft>(
    "lead_draft",
    {
      lead_name: nullableString(),
      phone: nullableString(),
      line_id: nullableString(),
      lead_type: nullableString(enums.leadTypes),
      marketing_channel: nullableString(enums.channels),
      contact_by: nullableString(enums.contactBys),
      gender: nullableString(enums.genders),
      nationality: nullableString(enums.nationalities),
      budget: nullableNumber("number"),
      interest_zone: nullableString(enums.zones),
      interest_property_type: nullableString(enums.propertyTypes),
      purpose: nullableString(enums.purposes),
      sell_reason: nullableString(enums.sellReasons),
      listing_code: nullableString(),
      remark: nullableString(),
    },
    system,
    raw
  );
  return { draft: data, usage };
}

/* ── LISTING ──────────────────────────────────────────────────────────────────── */

/**
 * The listing columns the AI may fill, keyed to lib/listingFields.ts.
 *
 * ── WHY A LIST AND NOT "ALL OF THEM" ────────────────────────────────────────────
 * LISTING_FIELDS has 42 entries and a broker's message contains maybe twenty. The rest are
 * not facts about the property at all — they are OUR workflow: which portals it has been
 * posted to, whether the sign is up, what the price used to be, where the owner sits in our
 * pipeline. Asking the model for those invites it to invent them, and every extra field
 * costs output tokens on every single call.
 *
 * ── WHY IT LIVES HERE AND NOT ON THE FIELD REGISTRY ─────────────────────────────
 * listingFields.ts describes the FORM. Whether the AI should guess at a column is a
 * property of the AI, and putting it there would mean two unrelated concerns editing one
 * file. The type, the label and the enum still come from the registry — this is only the
 * selection, plus the per-field coaching the registry has no place for.
 *
 * Adding a column here is all it takes for the parser to start reading it: the JSON schema,
 * the type and the allowed values are all derived below. The assertion at the bottom of
 * this block fails the build if a key ever stops existing.
 */
const AI_LISTING_HINTS: Record<string, string> = {
  property_type: "ประเภททรัพย์ เลือกจากรายการที่กำหนดเท่านั้น",
  zone: "ทำเล/ย่านที่ทรัพย์ตั้งอยู่ เลือกจากรายการที่กำหนดเท่านั้น",
  listing_type:
    'ประเภทประกาศ — ขายอย่างเดียว/ให้เช่าอย่างเดียว/ทั้งขายและเช่า ตามที่ข้อความบอก (มีทั้งราคาขายและค่าเช่า = ทั้งสองอย่าง)',
  unit_no: 'เลขห้อง หรือบ้านเลขที่ (เช่น "ห้อง 2508" → "2508")',
  bed: "จำนวนห้องนอนเป็นจำนวนเต็ม — สตูดิโอ ให้ตอบ 0",
  bath: "จำนวนห้องน้ำ",
  area_sqm: "พื้นที่ใช้สอย ตารางเมตร",
  area_rai: "ขนาดที่ดิน ไร่",
  area_ngan: "ขนาดที่ดิน งาน",
  area_wa: 'ขนาดที่ดิน ตารางวา (เช่น "50 ตร.ว." → 50)',
  floor: 'ชั้นที่ห้องอยู่ (เช่น "ชั้น 8" → "8") — บ้านให้ใส่จำนวนชั้น',
  building: 'ตึก/อาคาร (เช่น "ตึก A" → "A")',
  parking: "จำนวนที่จอดรถเป็นคัน",
  direction: "ทิศที่ห้อง/บ้านหัน เลือกจากรายการที่กำหนดเท่านั้น",
  view_type: "วิว เลือกจากรายการที่กำหนดเท่านั้น",
  unit_position: "ตำแหน่งห้อง เช่น ห้องมุม เลือกจากรายการที่กำหนดเท่านั้น",
  unit_condition: "สภาพห้อง/บ้าน เลือกจากรายการที่กำหนดเท่านั้น",
  in_out_project: "อยู่ในโครงการหรือนอกโครงการ เลือกจากรายการที่กำหนดเท่านั้น",
  road_soi: "ถนนหรือซอยที่ตั้ง",
  asking_price: "ราคาขาย เป็นตัวเลขบาทเต็ม",
  rental_price: "ค่าเช่าต่อเดือน เป็นตัวเลขบาทเต็ม — มีทั้งราคาขายและค่าเช่าให้ใส่ทั้งคู่",
  price_remark: "เงื่อนไขราคา เช่น ต่อรองได้ เลือกจากรายการที่กำหนดเท่านั้น",
  owner_name: "ชื่อเจ้าของทรัพย์ ตัดคำนำหน้าออก",
  owner_phone: "เบอร์โทรเจ้าของ เก็บเฉพาะตัวเลข",
  owner_line: "LINE ID ของเจ้าของ",
  remark: "รายละเอียดอื่นที่สำคัญและยังไม่ได้ลงช่องไหน สรุปสั้น ๆ ไม่มีให้ null",
};

/** The keys above, in registry order so the prompt reads top-down like the form does. */
export const AI_LISTING_KEYS: string[] = Object.keys(AI_LISTING_HINTS);

/** Fails loudly at import if a column is renamed in listingFields.ts and not here — the
 *  exact drift lib/listingFields.ts was created to end. */
const MISSING = AI_LISTING_KEYS.filter((k) => !LISTING_FIELD_MAP[k]);
if (MISSING.length) {
  throw new Error(
    `lib/ai/extract.ts: AI_LISTING_HINTS names columns that are not in LISTING_FIELDS: ${MISSING.join(", ")}`
  );
}

/**
 * Allowed values per lookup, read live.
 *
 * ⚠️ `zones` holds THAI NAMES (อโศก), not the zone_ids the column stores. The model reads
 * prose and prose says "อโศก"; lib/ai/parse.ts does the join back to ASK. Every other entry
 * IS the stored value, because those lookup tables are keyed on the label itself.
 */
export type ListingEnums = Partial<Record<ListingLookup, string[]>>;

/** What the model returns for a listing: the column values, plus the project name, which is
 *  not a column (it lives on main_3 and is chosen through a picker). */
export type RawListingDraft = Record<string, string | number | null> & {
  project_name: string | null;
};

function schemaFor(field: ListingField, enums: ListingEnums) {
  if (field.kind === "integer") return nullableNumber("integer");
  if (field.kind === "numeric") return nullableNumber("number");
  return nullableString(field.lookup ? enums[field.lookup] : undefined);
}

export async function extractListing(
  raw: string,
  enums: ListingEnums
): Promise<{ draft: RawListingDraft; usage: Usage }> {
  const lines = AI_LISTING_KEYS.map((key) => {
    const f = LISTING_FIELD_MAP[key];
    return `- ${key} (${f.label}): ${AI_LISTING_HINTS[key]}`;
  });

  const system =
    "คุณคือผู้ช่วยกรอกข้อมูลทรัพย์อสังหาฯ ให้ทีมขาย ดึงข้อมูลจากข้อความดิบที่ผู้ใช้วางมา " +
    "(ภาษาไทย มักเป็นข้อความฝากขายจาก LINE หรือโพสต์ของโบรกเกอร์) ลงในโครงสร้างที่กำหนด\n" +
    '- project_name: ชื่อโครงการ/คอนโด/หมู่บ้าน ตามที่ข้อความเขียน (เช่น "ลุมพินี พระราม 9")\n' +
    `${lines.join("\n")}\n` +
    THAI_NUMBERS;

  const properties: Record<string, unknown> = { project_name: nullableString() };
  for (const key of AI_LISTING_KEYS) {
    properties[key] = schemaFor(LISTING_FIELD_MAP[key], enums);
  }

  const { data, usage } = await extract<RawListingDraft>("listing_draft", properties, system, raw);
  return { draft: data, usage };
}
