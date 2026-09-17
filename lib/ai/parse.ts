import "server-only";
import { createClient } from "@/lib/supabase/server";
import { LISTING_FIELD_MAP } from "@/lib/listingFields";
import {
  AI_LISTING_KEYS,
  AiError,
  extractLead,
  extractListing,
  type ListingEnums,
  type Usage,
} from "@/lib/ai/extract";
import type { LeadParseDraft, ListingParseDraft, ParseKind } from "@/lib/ai/types";

/* The parse core: the AI reads, CODE decides.
 *
 * Everything the model returns is treated as a suggestion in a foreign vocabulary. This file
 * is what turns it into values the database will actually accept:
 *
 *   • every enum value is re-checked against the live lookup table — the schema constrains
 *     the model, this verifies it, and the two disagree whenever a list changed mid-flight
 *   • a Thai zone name becomes a zone_id
 *   • a project name becomes a project_id, or stays text and says so
 *   • a listing code that names nothing is DROPPED, because createLead would otherwise fail
 *     on a foreign key with a raw Postgres message
 *   • a phone that already belongs to a lead raises a duplicate note
 *
 * Record matching is deliberately not asked of the model: Klaichan's measured finding (from
 * Shelter before it) is that it gets record identity wrong about a fifth of the time. It is
 * excellent at reading prose and bad at joins, so it only does the first.
 *
 * NOT server actions. These are called by the job runner in lib/ai/jobs.ts, which owns the
 * permission check and passes the caller in.
 */

/** Error code → the Thai sentence the user sees. Exported so the runner can store an
 *  already-user-facing message on the failed row rather than a code the tray would show
 *  raw. */
export function messageFor(e: unknown): string {
  const code = e instanceof AiError ? e.message : "";
  switch (code) {
    case "AI_KEY_MISSING":
      return "ยังไม่ได้ตั้งค่า AI (ไม่มี API key) — แจ้งผู้ดูแลระบบ";
    case "AI_BAD_KEY":
      return "API key ไม่ถูกต้องหรือหมดอายุ — แจ้งผู้ดูแลระบบ";
    case "AI_NO_CREDIT":
      return "เครดิต OpenAI หมด — แจ้งผู้ดูแลระบบเติมเครดิต";
    case "AI_RATE_LIMIT":
      return "ใช้งานถี่เกินไป รอสักครู่แล้วกดลองใหม่";
    case "AI_UNAVAILABLE":
      return "ระบบ AI ขัดข้องชั่วคราว กดลองใหม่อีกครั้ง";
    case "AI_REFUSED":
      return "AI อ่านข้อความนี้ไม่ได้ ลองแก้ข้อความแล้วส่งใหม่";
    default:
      return "แยกข้อมูลไม่สำเร็จ กดลองใหม่อีกครั้ง";
  }
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

const digits = (s: string) => s.replace(/\D/g, "");
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");

/** Keep a model answer only if it is still in the live list. Case- and space-insensitive,
 *  because "Sale & Rent" and "Sale &Rent" are the same intent and only one is an FK. */
function pick(value: unknown, allowed: string[]): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const want = norm(value);
  return allowed.find((a) => norm(a) === want) ?? null;
}

/** A positive finite number, or null. The model occasionally answers 0 for "not mentioned";
 *  for every field we ask about, zero is either meaningless (a price) or genuinely zero (a
 *  studio's bed count) — so zero is kept and only nonsense is dropped. */
function num(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Best-effort token log. Never blocks and never fails a parse: a missing usage row costs a
 *  line in a report, a thrown one would cost the user their draft. */
async function recordUsage(supabase: Supabase, kind: ParseKind, usage: Usage) {
  try {
    await supabase.from("ai_usage").insert({
      kind,
      model: usage.model,
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
    });
  } catch {
    /* non-critical by design */
  }
}

/**
 * The zone vocabulary, both ways round.
 *
 * `labels` are the THAI NAMES shown to the model — prose says อโศก. `byName` maps its
 * answer back to the zone_id the column actually stores (ASK), and accepts the id itself
 * too, because pasted text sometimes quotes our own codes back at us.
 */
async function loadZones(
  supabase: Supabase
): Promise<{ byName: Map<string, string>; labels: string[] }> {
  const { data } = await supabase.from("zone").select("zone_id,name_thai").order("zone_id");
  const byName = new Map<string, string>();
  const labels: string[] = [];
  for (const z of (data ?? []) as { zone_id: string; name_thai: string | null }[]) {
    if (z.name_thai) {
      byName.set(norm(z.name_thai), z.zone_id);
      labels.push(z.name_thai);
    }
    byName.set(norm(z.zone_id), z.zone_id);
  }
  // A zone with no Thai name would otherwise be unreachable for the model — offer its id.
  return { byName, labels: labels.length ? labels : [...byName.values()] };
}

/** ListingLookup name → the table behind it. `zones` is absent on purpose: it is the one
 *  lookup whose stored value is not its label, so it goes through loadZones() instead. */
const LOOKUP_TABLE: Record<string, string> = {
  propertyTypes: "property_type",
  listingTypes: "listing_type",
  directions: "direction",
  viewTypes: "view_type",
  unitPositions: "unit_position",
  unitConditions: "unit_condition",
  inOutProjects: "in_out_project",
  priceRemarks: "price_remark",
  listingStatuses: "listing_status",
  listingPotentials: "listing_potential",
  ownerStages: "owner_stage",
};

/** The values of a lookup table keyed on its own label — which is most of them. */
async function names(supabase: Supabase, table: string): Promise<string[]> {
  const { data } = await supabase.from(table).select("name");
  return ((data ?? []) as { name: string }[]).map((r) => r.name);
}

/* ── LEAD ─────────────────────────────────────────────────────────────────────── */

export type LeadParseResult =
  | { ok: true; note: string | null; draft: LeadParseDraft; title: string | null }
  | { ok: false; error: string };

export async function parseLead(raw: string): Promise<LeadParseResult> {
  const text = raw.trim();
  if (!text) return { ok: false, error: "กรุณาวางข้อความก่อน" };

  const supabase = await createClient();
  try {
    // Every list read live — see the note in extract.ts about why these are not frozen.
    const [
      leadTypes, channels, contactBys, genders, nationalities,
      propertyTypes, purposes, sellReasons, zones,
    ] = await Promise.all([
      names(supabase, "lead_type"),
      names(supabase, "marketing_channel"),
      names(supabase, "contact_by"),
      names(supabase, "gender"),
      names(supabase, "nationality"),
      names(supabase, "property_type"),
      names(supabase, "lead_purpose"),
      names(supabase, "sell_reason"),
      loadZones(supabase),
    ]);

    const { draft: d, usage } = await extractLead(text, {
      leadTypes,
      channels,
      contactBys,
      genders,
      nationalities,
      propertyTypes,
      purposes,
      sellReasons,
      zones: zones.labels,
    });
    await recordUsage(supabase, "lead", usage);

    const notes: string[] = [];
    const leadType = pick(d.lead_type, leadTypes);
    const isOwner = !!leadType?.startsWith("Owner");

    /* purpose and sell_reason are the two halves of one question and belong to opposite
       sides of the buyer/owner toggle. Dropping the wrong-side one here rather than in the
       form means a draft can never carry a sell_reason into a buyer lead — which is exactly
       what LeadForm.submit() already guards against on the way out. */
    const purpose = isOwner ? null : pick(d.purpose, purposes);
    const sellReason = isOwner ? pick(d.sell_reason, sellReasons) : null;

    const phone = d.phone ? digits(d.phone) : "";

    /* Does a lead with this phone already exist?
       ⚠️ RLS scopes this to the reader's OWN leads unless they hold leads.view_all. The
       people who parse leads (Admin) do hold it, so in practice this sees everything — but
       a silent "no duplicate" from a narrower account is a false negative, not a promise.
       Advisory only: it never blocks the draft. */
    let duplicateLeadId: string | null = null;
    if (phone.length >= 9) {
      const { data: dupe } = await supabase
        .from("main_6_buyer_crm")
        .select("lead_id,lead_name")
        .eq("phone", phone)
        .limit(1)
        .maybeSingle();
      if (dupe) {
        duplicateLeadId = (dupe as { lead_id: string }).lead_id;
        const name = (dupe as { lead_name: string | null }).lead_name;
        notes.push(`⚠️ มีลีดเบอร์นี้อยู่แล้ว: ${duplicateLeadId}${name ? ` (${name})` : ""}`);
      }
    }

    /* A listing code the model read but we cannot find is DROPPED, not passed through:
       listing_code is a real foreign key as of 2026-09-10, so sending it would fail the
       insert. Saying so is more useful than a raw constraint error at save time. */
    let listingCode: string | null = null;
    const wantCode = d.listing_code?.trim().toUpperCase() ?? null;
    if (wantCode) {
      const { data: hit } = await supabase
        .from("main_4_listing_database")
        .select("listing_id")
        .eq("listing_id", wantCode)
        .maybeSingle();
      if (hit) {
        listingCode = wantCode;
        notes.push(`จับคู่ทรัพย์ ${wantCode}`);
      } else {
        notes.push(`ไม่พบทรัพย์รหัส ${wantCode} — ตรวจสอบอีกครั้ง`);
      }
    }

    const zone = d.interest_zone ? zones.byName.get(norm(d.interest_zone)) ?? null : null;

    const draft: LeadParseDraft = {
      lead_name: d.lead_name?.trim() || null,
      phone: phone || null,
      line_id: d.line_id?.trim() || null,
      lead_type: leadType,
      marketing_channel: pick(d.marketing_channel, channels),
      contact_by: pick(d.contact_by, contactBys),
      gender: pick(d.gender, genders),
      nationality: pick(d.nationality, nationalities),
      budget: num(d.budget),
      interest_zone: zone,
      interest_property_type: isOwner ? null : pick(d.interest_property_type, propertyTypes),
      purpose,
      sell_reason: sellReason,
      listing_code: listingCode,
      remark: d.remark?.trim() || null,
      duplicateLeadId,
    };

    const filled = Object.entries(draft).filter(
      ([k, v]) => k !== "duplicateLeadId" && v != null && v !== ""
    ).length;
    notes.unshift(`อ่านได้ ${filled} ช่อง`);

    return { ok: true, note: notes.join(" · "), draft, title: draft.lead_name };
  } catch (e) {
    return { ok: false, error: messageFor(e) };
  }
}

/* ── LISTING ──────────────────────────────────────────────────────────────────── */

export type ListingParseResult =
  | { ok: true; note: string | null; draft: ListingParseDraft; title: string | null }
  | { ok: false; error: string };

export async function parseListing(raw: string): Promise<ListingParseResult> {
  const text = raw.trim();
  if (!text) return { ok: false, error: "กรุณาวางข้อความก่อน" };

  const supabase = await createClient();
  try {
    /* Only the lookups the AI fields actually use are read. Deriving that set from the
       registry rather than listing it means adding a column to AI_LISTING_HINTS pulls its
       vocabulary in automatically — nothing else to remember. */
    const needed = [
      ...new Set(
        AI_LISTING_KEYS.map((k) => LISTING_FIELD_MAP[k].lookup).filter(
          (l): l is NonNullable<typeof l> => !!l
        )
      ),
    ];
    const zones = await loadZones(supabase);
    const enums: ListingEnums = { zones: zones.labels };
    await Promise.all(
      needed
        .filter((l) => l !== "zones")
        .map(async (l) => {
          const table = LOOKUP_TABLE[l];
          if (table) enums[l] = await names(supabase, table);
        })
    );

    const { draft: d, usage } = await extractListing(text, enums);
    await recordUsage(supabase, "listing", usage);

    const notes: string[] = [];

    /* Every value re-checked against the live list, then stringified — ListingForm's draft
       is all strings and booleans, and handing it a number would make its dirty-diff
       compare a number against the "" it started with on every keystroke. */
    const values: Record<string, string> = {};
    for (const key of AI_LISTING_KEYS) {
      const field = LISTING_FIELD_MAP[key];
      const got = d[key];
      if (got == null) continue;

      if (key === "zone") {
        const id = typeof got === "string" ? zones.byName.get(norm(got)) : null;
        if (id) values.zone = id;
        else if (typeof got === "string" && got.trim()) {
          notes.push(`ไม่รู้จักทำเล “${got}” — เลือกเอง`);
        }
        continue;
      }

      if (field.kind === "integer" || field.kind === "numeric") {
        const n = num(got);
        if (n != null) values[key] = String(n);
        continue;
      }

      if (field.lookup) {
        const hit = pick(got, enums[field.lookup] ?? []);
        if (hit) values[key] = hit;
        else if (typeof got === "string" && got.trim()) {
          notes.push(`ไม่รู้จัก${field.label} “${got}” — เลือกเอง`);
        }
        continue;
      }

      const s = String(got).trim();
      if (s) values[key] = key === "owner_phone" ? digits(s) : s;
    }

    // ── the project, which is not a column ───────────────────────────────────────
    const projectNameRaw = d.project_name?.trim() || null;
    let projectId: string | null = null;
    let projectLabel: string | null = null;

    if (projectNameRaw) {
      /* Exact normalised match first, then containment either way — the same rule
         lib/search.ts uses for the picker, and against both name columns, because sheet
         data put Thai names in the English column often enough that matching one would
         miss real projects. 308 rows, so one read beats a query per candidate. */
      const { data: rows } = await supabase
        .from("main_3_property_detail")
        .select("project_id,project_name_thai,project_name_eng");
      const projects = (rows ?? []) as {
        project_id: string;
        project_name_thai: string | null;
        project_name_eng: string | null;
      }[];
      const want = norm(projectNameRaw);
      const named = (p: (typeof projects)[number]) =>
        [p.project_name_thai, p.project_name_eng].filter((x): x is string => !!x);

      const hit =
        projects.find((p) => named(p).some((n) => norm(n) === want)) ??
        projects.find((p) =>
          named(p).some((n) => norm(n).includes(want) || want.includes(norm(n)))
        );

      if (hit) {
        projectId = hit.project_id;
        projectLabel = hit.project_name_thai ?? hit.project_name_eng ?? hit.project_id;
        notes.push(`จับคู่โครงการ “${projectLabel}”`);
      } else {
        notes.push(`ไม่พบโครงการ “${projectNameRaw}” ในระบบ — เลือกหรือสร้างใหม่เอง`);
      }
    }

    /* property_type and zone are what the set_listing_id trigger builds the code from, so
       a draft missing either cannot be saved. Better said here than discovered at บันทึก. */
    const missing = [
      !values.property_type && "ประเภททรัพย์",
      !values.zone && "ทำเล",
    ].filter(Boolean);
    if (missing.length) notes.push(`ยังขาด: ${missing.join(" · ")}`);

    notes.unshift(`อ่านได้ ${Object.keys(values).length} ช่อง`);

    return {
      ok: true,
      note: notes.join(" · "),
      draft: { values, projectId, projectLabel, projectNameRaw },
      title: projectLabel ?? projectNameRaw,
    };
  } catch (e) {
    return { ok: false, error: messageFor(e) };
  }
}
