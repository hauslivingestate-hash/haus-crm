# HAUS CRM — Design System

The single source of truth for how the HAUS CRM looks and is built.

**Aesthetic:** Linear/Attio minimalism — flat surfaces, hairline borders, tight
density, one restrained accent — carrying the **HAUS crimson** brand. Thai-first
UI (the term "Lead" stays English), Buddhist-era dates. Light is the reference
theme; dark is scaffolded but not yet tuned.

> This is a handoff spec. It is written so a developer **or an AI coding agent**
> can build the real app without re-deriving any decision. See
> [For AI coding agents](#for-ai-coding-agents) at the bottom.

---

## What this is (and isn't)

- **Is:** the design language — tokens, type, components, rules — proven in a
  clickable mockup (see `styleguide.html` in this folder, and the reference
  dashboard mockup linked in the changelog).
- **Isn't:** the app itself. There is no React code yet. When the app is
  scaffolded, `tokens.css` becomes `app/globals.css` and the components below get
  built in `components/ui/`.

## Where things live (target project structure)

| Layer | File | Rule |
|---|---|---|
| **Tokens** | `app/globals.css` (use `tokens.css` from this folder) | The only place hex values are allowed. |
| **Components** | `components/ui/` | Built from tokens; never hard-code colors. |
| **Live reference** | `app/styleguide/page.tsx` | Port `styleguide.html` here; check every new screen against it. |
| **Theme switch** | `components/theme-provider.tsx` | `next-themes`, class-based (`<html class="dark">`). Dark is provisional. |

Stack: **Next.js + Tailwind v4 + React**. Fonts via `next/font/google`:
**Anuphan** (UI, Thai+Latin) and **IBM Plex Mono** (numerals).

---

## Token architecture (two tiers)

1. **Primitives** — raw palette, theme-invariant. Brand crimson, status hues,
   vivid stage dots, grade-chip colors.
2. **Semantic roles** — `--background`, `--surface`, `--surface-2`, `--text`,
   `--text-muted`, `--text-subtle`, `--border`, `--border-strong`, `--accent`,
   `--accent-hover`, `--accent-wash`, `--ring`. These **swap between light and
   dark**. **Components use only these.**

Tailwind v4 exposes them via `@theme inline`, so every token is a utility:
`bg-surface`, `text-text-muted`, `border-border`, `bg-accent`, `text-accent`,
`bg-green-bg text-green`, `rounded-md`, `shadow-pop`, etc. Because the map is
`inline`, utilities re-resolve per theme automatically.

### Core rules

- **Never** write a hex in a component. Add/extend a token in `globals.css`.
- **The logo maroon `#631222` is NOT the UI accent.** The app accent is the
  brighter `crimson-500 #a32638` (same hue, brighter step). Logo keeps the deep
  maroon; everything interactive uses `--accent`.
- **Crimson is the only brand accent.** Use it sparingly: primary action, active
  nav, key figures, links, focus rings. Everything else stays neutral stone.
- **Numbers** (prices, counts, dates, phone, times) get `className="num"` → IBM
  Plex Mono, tabular, tight. This is a signature of the look.
- **Status = dot + plain text**, not filled pills. Reserve solid fills for
  **grade chips** (A/B/C) and count/emphasis pills.
- **Structure with borders, not shadows.** `shadow-pop` is for popovers/menus
  only; cards and panels are defined by `border-border`.
- **Warm-neutral, not beige.** Neutrals are warm *stone* (`#fafaf9`, `#ecebe9`),
  not cream. Cream/serif is the **portal's** language, not the CRM's — keeping
  the CRM cool-neutral is what makes it read modern rather than vintage.

---

## Color

### Brand & accent
| Token | Hex | Use |
|---|---|---|
| `maroon-900` | `#631222` | **Logo only.** Never a UI accent. |
| `accent` (`crimson-500`) | `#a32638` | Primary buttons, active nav, links, key numbers, focus ring |
| `accent-hover` (`crimson-600`) | `#8e1d36` | Hover/pressed |
| `accent-wash` | `#a32638` @ 12% | Active nav background, selected rows |
| `bronze-500` | `#8a5a32` | **Rent unit** accent (remap `--accent` on `/rent`) |

### Neutrals (light)
`background #fafaf9` · `surface #ffffff` · `surface-2 #f5f5f4` ·
`border #ecebe9` · `border-strong #e0dedb` ·
`text #1c1917` · `text-muted #78716c` · `text-subtle #a6a09b`

### Status — text-safe, reserved for state (dot + text, never decoration)
`green #237a46` (won/paid) · `blue #2f6fa8` (info/new) · `amber #95660a`
(follow-up/expiring) · `red #c4491f` (danger/destructive) · `violet #9057a8`.
Each has a `-bg` tint at ~12% for the rare filled case.

> **Danger is vermilion `#c4491f`, deliberately orange-leaning** so a destructive
> button never reads as the crimson accent. (Hue sits 24° off the accent; passes
> 4.8:1 with white text.) *This is the one value changed from the mockups' earlier
> `#be3425` — see changelog. Veto-able in one line if you disagree.*

### Pipeline stage dots — VIVID, dots & marks only
Fixed order, CVD-validated as a set. **Never** use these as text (they fail small-
text contrast) and **never** recolor a stage by rank.

| Stage (TH) | Token | Hex |
|---|---|---|
| ใหม่ (New) | `dot-blue` | `#2a6dfb` |
| ติดต่อแล้ว (Contacted) | `dot-teal` | `#00a0a0` |
| คัดกรองแล้ว (Qualified) | `dot-violet` | `#7c5cff` |
| นัดชม (Viewing) | `dot-amber` | `#c08000` |
| เจรจาต่อรอง (Negotiation) | `dot-crimson` | `#a32638` (the money stage wears the brand) |
| ปิดการขาย (Won) | `dot-green` | `#23a55a` |

Reads cool → warm → green, left to right, as deals heat up.

### Potential grade chips — solid vivid fill + bold letter
Square 20px rounded chip. **A gets a dark letter** (white on yellow is unreadable).

| Grade | Fill | Letter |
|---|---|---|
| A | `#ffc53d` gold | `#1c1917` dark |
| B | `#2563eb` blue | white |
| C | `#dc2626` red | white |

> **Visual grammar:** round dots = pipeline stage; square chips = grade. Shape
> distinguishes the two systems before color does.
> **Watch in real use:** red C can out-shout gold A in a long table. If eyes go to
> the wrong rows, mute C to an outline chip.

---

## Typography

Two faces, both loaded via `next/font`:
- **Anuphan** — loopless geometric sans (Thai + Latin), all UI text.
- **IBM Plex Mono** — every numeral, via `.num`.

| Token | Size / line | Use |
|---|---|---|
| `text-display` | 24 / 32 | Big KPI values, empty-state headers |
| `text-h1` | 19 / 25.6 | Page titles |
| `text-h2` | 16 / 23 | Card / panel titles |
| `text-h3` | 14 / 20.8 | Sub-sections |
| `text-body` | 13 / 21.6 | Default (Thai-safe leading) |
| `text-small` | 12 / 18.4 | Metadata, secondary |
| `text-label` | 11 / 16 · caps · +0.03em | Table headers, eyebrows |

**Thai rule:** never set Thai below ~1.55 line-height or in all-caps tracking —
stacked vowels/tone marks clip. `text-label` uppercase is Latin-only; Thai
eyebrows use Anuphan 600 at normal tracking.

## Shape & elevation
Radii: `sm 7px` (controls, chips), `md 9px` (buttons, inputs, wells),
`lg 12px` (cards, panels). Shadows: `shadow-card` (barely-there rest state),
`shadow-pop` (menus/popovers only). Everything else is defined by borders.

---

## Components (`components/ui/`)

Build these from tokens, `cva` for variants, `cn()` to merge classNames,
`forwardRef` for form atoms. Each should get a live example in `/styleguide`.

- **Button** — `primary` / `secondary` / `ghost` / `danger` × `sm` / `md` / `lg` / `icon`
- **Input**, **Select**, **Textarea** — hairline border, crimson focus ring + wash
- **Card** (+ `Header` / `Title` / `Content`) — surface + border, `rounded-lg`
- **Stat** — KPI tile: label, big `.num` value, delta (green/red), optional sparkline
- **StatusBadge** / **Dot** — colored dot + plain text (the status pattern)
- **GradeChip** — solid A/B/C square chip
- **Pill** — soft filled chip, counts/emphasis only
- **Avatar** — initials + tone (crimson for people, neutral in dense tables)
- **Segmented** — Today / Month / Quarter style toggle (track = `surface-2`)
- **Table** (`Table` / `THead` / `TBody` / `TR` / `TH` / `TD`) — hairline rows, `.num` cells right-aligned
- **PipelineBoard** — hairline-divided stage columns (not floating kanban); each column = stage dot + name + count, mini lead cards inside
- **Sidebar** — 228px rail, unit switcher (ขาย/เช่า), ⌘K search, grouped nav, active = `accent-wash` bg + accent-colored icon

## Language & formatting
- **UI is Thai.** The single English term kept is **"Lead"** (nav, buttons,
  labels). Loanwords Thai teams actually say stay transliterated: ไปป์ไลน์, ดีล,
  คอมมิชชั่น, วอล์กอิน, เอเจนต์.
- **Dates: Buddhist era** (พ.ศ. 2569), Thai month abbreviations.
- **Money:** `฿12.9M` → `฿12.9 ล้าน`; rent `฿85,000/ด.`. Always `.num`.

---

## For AI coding agents

If you are building this app from this spec:

1. **Read `tokens.css` first.** It is authoritative. Copy it to `app/globals.css`.
   Every color/space/type decision is a token — never invent a hex.
2. **Wire fonts** in `app/layout.tsx` with `next/font/google`: `Anuphan`
   (subsets `["thai","latin"]`) → CSS var `--font-anuphan`; `IBM_Plex_Mono` →
   `--font-plex-mono`. The token map already references these vars.
3. **Build `components/ui/` in the order screens need them** (Button, Input,
   Card, Stat, StatusBadge, GradeChip, Table, then PipelineBoard, then Sidebar).
   Match the specs above and the visuals in `styleguide.html`.
4. **Obey the core rules** (no hex in components; `.num` on every numeral;
   dot+text status; borders not shadows; crimson used sparingly). These are what
   make it look right — not optional polish.
5. **Check every screen against `/styleguide`.** If a component isn't there, add
   it there first, then use it.
6. Light theme is the reference. The `.dark` block exists but is **untuned** —
   do not treat dark as done; flag it for a design pass.

---

## Changelog / open decisions
- **v9 (2026-07):** established from the HAUS CRM dashboard mockup. Shelter-style
  shell, stone neutrals, crimson accent `#a32638`, IBM Plex Mono numerals, vivid
  CVD-validated stage dots, solid A/B/C grade chips, Thai UI.
- **danger → `#c4491f`:** changed from the mockup's `#be3425` to sit clear of the
  brighter accent. **Open for veto.**
- **dark mode:** scaffolded, not visually reviewed. Decision was light-only for
  launch; revisit for agents doing evening viewings.
