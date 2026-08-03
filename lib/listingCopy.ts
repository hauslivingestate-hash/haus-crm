// Listing ad-copy ("คำประกาศโฆษณา") — a DETERMINISTIC template-fill engine (no AI), adapted
// from the Shelter CRM. A template is picked by the listing's Grade × Type, its <placeholders>
// are substituted from the listing's fields, and three ready-to-paste outputs are produced:
// Headline · Normal (Facebook / Livinginsider / PropertyHub) · DDproperty (emoji-free).
//
// Design-first: the default templates below are the code layer. The CopyTemplatesProvider holds
// editable overrides in memory. Wire later = a `listing_templates` table (composite key
// grade|type) that overrides these row-by-row; listingCopy() already falls back to the code
// default per combo, so an empty table still yields correct copy. See COPYWRITING_FEATURE.md.

import type { ListingRow } from "@/lib/queries";
import { potentialGroup } from "@/lib/status";
import { dealType } from "@/lib/format";

export type CopyGrade = "exclusive" | "a_list" | "normal";
export type CopyType = "sale" | "rent" | "both";

export const COPY_GRADES: { key: CopyGrade; label: string }[] = [
  { key: "exclusive", label: "Exclusive" },
  { key: "a_list", label: "A List" },
  { key: "normal", label: "Normal" },
];
export const COPY_TYPES: { key: CopyType; label: string }[] = [
  { key: "sale", label: "ขาย" },
  { key: "rent", label: "เช่า" },
  { key: "both", label: "ขาย + เช่า" },
];

// Literal, human-readable tokens inserted via chips in the editor and replaced per listing.
// Only HAUS-available fields (no floor / land / parking / direction — those aren't in the model).
export const COPY_PLACEHOLDERS = [
  "<Project>",
  "<Listing Name>",
  "<Listing ID>",
  "<Zone>",
  "<Property Type>",
  "<Bed>",
  "<Bath>",
  "<Sqm.>",
  "<Asking Price>",
  "<Rental Price>",
] as const;

export interface CopyTemplate {
  headline: string;
  normalBody: string;
  ddBody: string;
}
export interface ListingCopyResult {
  headline: string;
  normal: string;
  dd: string;
}

export function comboKey(grade: CopyGrade, type: CopyType): string {
  return `${grade}|${type}`;
}
export function splitKey(key: string): [CopyGrade, CopyType] {
  const [g, t] = key.split("|");
  return [g as CopyGrade, t as CopyType];
}

// Derive the matrix combo from a listing. Grade from potential (normal is the fallback);
// type from which prices are present (dealType "none" → sale fallback).
export function listingGrade(l: ListingRow): CopyGrade {
  return potentialGroup(l.potential);
}
export function listingCopyType(l: ListingRow): CopyType {
  const d = dealType(l.asking_price, l.rental_price);
  return d === "rent" ? "rent" : d === "both" ? "both" : "sale";
}

// ── Code-default templates ──────────────────────────────────────────────────
const ACTION: Record<CopyType, string> = { sale: "ขาย", rent: "ให้เช่า", both: "ขาย / ให้เช่า" };
const EMOJI: Record<CopyGrade, string> = { exclusive: "🔥", a_list: "✨", normal: "🏡" };

function priceLine(type: CopyType, dd = false): string {
  const bullet = dd ? "" : "💰 ";
  if (type === "sale") return `${bullet}ราคา <Asking Price> บาท`;
  if (type === "rent") return `${bullet}ค่าเช่า <Rental Price> บาท/เดือน`;
  return `${bullet}ขาย <Asking Price> บาท ${dd ? "/" : "·"} เช่า <Rental Price> บาท/เดือน`;
}

export function defaultTemplate(grade: CopyGrade, type: CopyType): CopyTemplate {
  const urgent = grade === "exclusive" ? "ด่วน!" : "";
  const headline = `${EMOJI[grade]} ${ACTION[type]}${urgent} <Property Type> <Project> <Zone>`;
  const normalBody = [
    `${ACTION[type]} <Property Type> <Project>`,
    `📍 <Zone>`,
    `▪️ <Bed> ห้องนอน`,
    `▪️ <Bath> ห้องน้ำ`,
    `▪️ พื้นที่ <Sqm.> ตร.ม.`,
    priceLine(type),
    `🏷️ รหัสทรัพย์ <Listing ID>`,
    ``,
    `สนใจนัดชมหรือสอบถามเพิ่มเติม ทักได้เลยค่ะ 😊`,
    `#HausLiving #<Property Type> #<Zone>`,
  ].join("\n");
  const ddBody = [
    `${ACTION[type]} <Property Type> <Project>`,
    `ทำเล <Zone>`,
    `- <Bed> ห้องนอน`,
    `- <Bath> ห้องน้ำ`,
    `- พื้นที่ <Sqm.> ตร.ม.`,
    priceLine(type, true),
    `รหัสทรัพย์ <Listing ID>`,
  ].join("\n");
  return { headline, normalBody, ddBody };
}

/** All 9 combos seeded from code defaults — the CopyTemplatesProvider's initial state. */
export function defaultTemplateMap(): Record<string, CopyTemplate> {
  const map: Record<string, CopyTemplate> = {};
  for (const g of COPY_GRADES) for (const t of COPY_TYPES) map[comboKey(g.key, t.key)] = defaultTemplate(g.key, t.key);
  return map;
}

export function isDefaultTemplate(key: string, tpl: CopyTemplate): boolean {
  const [g, t] = splitKey(key);
  const d = defaultTemplate(g, t);
  return tpl.headline === d.headline && tpl.normalBody === d.normalBody && tpl.ddBody === d.ddBody;
}

// ── Render engine ───────────────────────────────────────────────────────────
function fmt(n: number | null): string {
  return n == null ? "" : n.toLocaleString("en-US");
}

function values(l: ListingRow): Record<string, string> {
  return {
    "<Project>": l.project_name_eng ?? "",
    "<Listing Name>": l.listing_name ?? l.project_name_eng ?? l.listing_id,
    "<Listing ID>": l.listing_id,
    "<Zone>": l.zone_name_thai ?? l.zone ?? "",
    "<Property Type>": l.property_type ?? "",
    "<Bed>": l.bed == null ? "" : String(l.bed),
    "<Bath>": l.bath == null ? "" : String(l.bath),
    "<Sqm.>": fmt(l.area_sqm),
    "<Asking Price>": fmt(l.asking_price),
    "<Rental Price>": fmt(l.rental_price),
  };
}

// Substitute <tokens>, then clean up so listings with missing fields read cleanly: a detail
// bullet whose value is empty is dropped whole (no dangling "ห้องนอน"), stray double-spaces and
// blank-line runs collapse. Title/hashtag lines keep going even if a token is empty.
function fill(template: string, v: Record<string, string>): string {
  const kept: string[] = [];
  for (const line of template.split("\n")) {
    const tokens = line.match(/<[^>]+>/g) ?? [];
    if (tokens.length) {
      const isBullet = /^\s*(▪️|📍|💰|🏷️|-)/.test(line) || tokens.length === 1;
      if (isBullet && tokens.some((t) => !v[t])) continue; // drop detail line missing its value
    }
    let filled = line;
    for (const t of tokens) filled = filled.split(t).join(v[t] ?? "");
    kept.push(filled.replace(/\s{2,}/g, " ").replace(/\s+$/g, ""));
  }
  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Entry point: fill the combo's template (override wins, else code default) for a listing. */
export function listingCopy(l: ListingRow, overrides: Record<string, CopyTemplate>): ListingCopyResult {
  const key = comboKey(listingGrade(l), listingCopyType(l));
  const tpl = overrides[key] ?? defaultTemplate(...splitKey(key));
  const v = values(l);
  return { headline: fill(tpl.headline, v), normal: fill(tpl.normalBody, v), dd: fill(tpl.ddBody, v) };
}
