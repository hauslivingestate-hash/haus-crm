// ------- Number / money / date formatting (HAUS conventions) -------
// Money: ฿12.9M -> "฿12.9 ล้าน" ; rent -> "฿85,000/ด." ; always paired with .num

export const TH_MONTHS = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

export function formatBaht(value: number | null | undefined): string {
  if (value == null) return "—";
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    const s = m % 1 === 0 ? m.toFixed(0) : m.toFixed(1);
    return `฿${s} ล้าน`;
  }
  return `฿${value.toLocaleString("en-US")}`;
}

// Rent / monthly price: ฿85,000/ด.
export function formatRent(value: number | null | undefined): string {
  if (value == null) return "—";
  return `฿${value.toLocaleString("en-US")}/ด.`;
}

// A listing can be for sale, for rent, or both. Deal type is derived from which
// prices are present — not a single stored listing_type — so one property can
// carry a sale price and a rent price at once.
export type DealType = "sale" | "rent" | "both" | "none";

export function dealType(
  askingPrice: number | null | undefined,
  rentalPrice: number | null | undefined
): DealType {
  const sale = askingPrice != null;
  const rent = rentalPrice != null;
  if (sale && rent) return "both";
  if (sale) return "sale";
  if (rent) return "rent";
  return "none";
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null) return "—";
  return value.toLocaleString("en-US");
}

// Buddhist-era Thai date: "2026-07-06" -> "6 ก.ค. 2569"
export function formatThaiDate(input: string | Date | null | undefined): string {
  if (!input) return "—";
  const d = typeof input === "string" ? new Date(input + "T00:00:00") : input;
  if (isNaN(d.getTime())) return "—";
  const day = d.getDate();
  const month = TH_MONTHS[d.getMonth()];
  const year = d.getFullYear() + 543;
  return `${day} ${month} ${year}`;
}

export function daysOnMarketLabel(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${n} วัน`;
}

// Thai land area comes from three split columns (Listings cols AF/AG/AH). The conventional
// notation is ไร่-งาน-วา, e.g. "2-1-50" = 2 ไร่ 1 งาน 50 ตร.วา. Returns null when the
// property has no land figures at all (condos), so callers can drop the row entirely
// rather than render a dash.
export function formatLandArea(
  rai: number | null | undefined,
  ngan: number | null | undefined,
  wa: number | null | undefined
): string | null {
  // Treat 0 the same as absent. The import writes real zeros (not nulls) for the units a
  // property doesn't use, so a `== null` check alone would still render the misleading
  // "0-0-24 ไร่" / "0-0-0 ไร่" this function exists to avoid.
  const r = rai || 0;
  const n = ngan || 0;
  const w = wa || 0;
  if (r === 0 && n === 0 && w === 0) return null;
  // วา alone is the common case for townhouses/condos with a small plot — show it plainly.
  if (r === 0 && n === 0) return `${formatNumber(w)} ตร.วา`;
  return `${r}-${n}-${w} ไร่`;
}
