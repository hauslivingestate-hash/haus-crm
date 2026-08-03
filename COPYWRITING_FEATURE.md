# HAUS CRM — Listing Ad Copy ("คำประกาศโฆษณา")

**Status:** Design-first UI built, DB wiring deferred
**Last updated:** 2026-07-25

> **Build approach: design-first UI, no DB yet.** Templates live in memory
> (`CopyTemplatesProvider`), seeded from code defaults in `lib/listingCopy.ts`, and reset on
> reload. This doc records the wire-later target so we don't forget. Adapted from the
> **Shelter CRM** copywriting system (a deterministic template-fill engine — *not* AI).

---

## What it does

A **deterministic template-fill engine**: pick a template by the listing's **Grade × Type**,
substitute `<placeholders>` from the listing's fields, output three ready-to-paste blocks —
**Headline · Normal** (Facebook / Livinginsider / PropertyHub) **· DDproperty** (emoji-free).

- **Listing page:** a "สร้างคำโฆษณา" button on the การตลาด card opens a drawer with the three
  blocks + copy-to-clipboard. (`components/ListingCopyButton.tsx`)
- **Settings → คำโฆษณา:** a Grade × Type matrix editor; each cell edits Headline / Normal / DD
  with placeholder-insert chips + reset-to-default; an amber dot marks edited combos.
  Gated `copy.manage` (CEO + Marketing + Listing Support). (`components/CopyTemplateEditor.tsx`)

## Where HAUS differs from Shelter (decisions made)

| | Shelter | HAUS (this build) |
|---|---|---|
| Matrix axes | in/out × grade(A/B/C/Excl) × type(4) = 32 | **grade(Exclusive/A List/Normal) × type(sale/rent/both) = 9** |
| In/out project | explicit matrix axis | **dropped** — fill uses project name if present, else listing name |
| Placeholders | incl. floor/land/parking/direction | **HAUS subset** — no floor/land/parking/direction (not in the model) |
| Channels | Headline / Normal / DD | same |

## Engine (already built, pure — reusable at wiring)

`lib/listingCopy.ts`:
- `defaultTemplate(grade, type)` / `defaultTemplateMap()` — the code-default layer.
- `listingCopy(listing, overrides)` — override wins per combo, else code default; then `fill()`.
- `fill()` drops detail bullets whose value is empty (no dangling "ห้องนอน"), collapses spaces
  / blank lines.
- `COPY_PLACEHOLDERS` — the token list; `comboKey()/splitKey()` — the `grade|type` key.

## Wire-later target (DB)

Mirror Shelter's **code-default + row-override** pattern:

```sql
create table listing_templates (
  id          uuid primary key default gen_random_uuid(),
  grade       text not null,   -- exclusive | a_list | normal
  listing_type text not null,  -- sale | rent | both
  headline    text not null default '',
  normal_body text not null default '',
  dd_body     text not null default '',
  updated_by  text,
  updated_at  timestamptz not null default now(),
  unique (grade, listing_type)
);
```

- `CopyTemplatesProvider` becomes a fetch + mutation layer over this table.
- `listingCopy()` already falls back to the code default when a row is missing — so an empty
  table still produces correct copy; the editor just won't show overrides until rows exist.
- **Seed step (don't skip):** Shelter's repo relied on the 32 rows being inserted out-of-band
  and it was never scripted — so its Settings editor lists nothing until done manually. For
  HAUS, add an explicit seed that inserts all 9 combos from `defaultTemplateMap()`.

## Open items

1. Placeholder set — confirm the HAUS field list is complete (add e.g. `<Price Remark>` if a
   remark field lands on the listing).
2. Grade source — currently `potential` (Exclusive/A List/Normal). If "A List + Fb add" style
   messy values persist, `potentialGroup()` already normalizes them.
3. Hashtag/emoji house style — the seed copy is a first pass; Marketing will tune it in Settings.
