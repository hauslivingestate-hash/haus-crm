/* The colours an admin may assign to a lookup value.

   THESE ARE THE GOOGLE SHEETS PASTELS, on purpose (Ben, 2026-09-06: "make the
   color match the tone of what's on the google sheets"). The team read this
   data in Stone Haus Living Listing for a year before the CRM existed, and a
   grid that colours the same statuses in a different key reads as a different
   system. The exact hues are lifted from that spreadsheet's own conditional
   formats on the Last Match tab (#FCE5CD, #F4CCCC, #D9EAD3, #FFF2CC,
   #C9DAF8) — the standard Sheets "light 3" row, plus its light-2 red for the
   one state that has to shout.

   WHY THESE ARE RAW HEX AND NOT DESIGN TOKENS. Everywhere else in this app a
   colour is a semantic token, and globals.css says so. These are the one
   deliberate exception: they are not our palette, they are a QUOTATION of
   someone else's, and mapping them onto --dot-blue and friends would drift the
   moment either palette moved. They live in this one file, are never written
   into a component, and reach the DOM only through .cell-wash.

   THE DOT IS NOT THE PASTEL. Every swatch also names its strong twin, a
   `bg-dot-*` token from globals.css, for the places that draw a status as an
   8px dot rather than a filled cell (StatusBadge, the pipeline dots, the pill
   pickers). A pastel dot on a grey pill is invisible, and this is what lets
   one choice in ตั้งค่า colour the Lead grid AND Lead Database the same way
   (Ben, 2026-09-16) — before this the dots had their own map in code.

   A CLOSED SET, NOT A COLOUR PICKER. A free hue chosen against the white
   canvas can vanish or glare in dark mode, and the person choosing it is not
   the person reading the grid at 8pm.

   Token names are stable — they are what the database stores. Changing a
   token's `cssVar` recolours every value using it; renaming a token would
   orphan them, so don't.

   Client-safe: no DB import, so both the grid and the settings screen can
   import it. */

export interface Swatch {
  /** Stored in the lookup table's `color` column. Stable — see above. */
  token: string;
  /** Thai label for the settings picker. */
  label: string;
  /** The colour, handed to .cell-wash as --wash-hue. */
  cssVar: string;
  /** The same colour as a dot — a `bg-dot-*` utility (globals.css), full strength. */
  dot: string;
}

export const PALETTE: Swatch[] = [
  { token: "green",   label: "เขียว",   cssVar: "#d9ead3", dot: "bg-dot-green" },   // light green 3
  { token: "teal",    label: "ฟ้าอมเขียว", cssVar: "#d0e0e3", dot: "bg-dot-teal" }, // light cyan 3
  { token: "blue",    label: "น้ำเงิน",  cssVar: "#c9daf8", dot: "bg-dot-blue" },    // light cornflower 3
  { token: "violet",  label: "ม่วง",    cssVar: "#d9d2e9", dot: "bg-dot-violet" },  // light purple 3
  { token: "amber",   label: "เหลือง",  cssVar: "#fff2cc", dot: "bg-dot-amber" },   // light yellow 3
  { token: "orange",  label: "ส้ม",     cssVar: "#fce5cd", dot: "bg-dot-accent" },  // light orange 3
  { token: "crimson", label: "ชมพู",    cssVar: "#ead1dc", dot: "bg-dot-crimson" }, // light magenta 3
  { token: "red",     label: "แดง",     cssVar: "#f4cccc", dot: "bg-dot-red" },     // light red 3
  { token: "redStrong", label: "แดงเข้ม", cssVar: "#ea9999", dot: "bg-dot-red-strong" }, // light red 2 — overdue
  { token: "slate",   label: "เทา",     cssVar: "#efefef", dot: "bg-dot-slate" },   // light grey 2
];

const BY_TOKEN = new Map(PALETTE.map((s) => [s.token, s]));

export const isPaletteToken = (t: string): boolean => BY_TOKEN.has(t);

/** A stored token → its swatch. Unknown or null returns undefined, and the
    caller renders the cell unfilled. An admin who clears a colour, or a token
    retired from the palette in a release, must degrade to "no colour" — never
    to a crash and never to a wrong colour. */
export function swatch(token: string | null | undefined): Swatch | undefined {
  return token ? BY_TOKEN.get(token) : undefined;
}
