# HAUS CRM — A-List / Exclusive Value-Add Checklists

**Status:** Spec / design-approved, not yet built
**Last updated:** 2026-07-24

> **Build approach: design-first UI, no DB wiring yet.** This feature follows the same
> convention as the rest of the app — seeded constants in `lib/*.ts` + a React context
> store (mirror `MasterDataProvider` / `RbacProvider`), state held in memory, resets on
> reload. Identity uses the in-memory seeded user. Document items show an in-browser
> preview (`URL.createObjectURL`, like `EmployeeRecord.tsx`), not persisted. The Supabase
> table shapes in §6 are documented as the **eventual wire-later target**, not built now.
> This means **the auth decision (§11) does not block anything** — see that section.

---

## 1. Goal

The `potential` tag (`A List` / `Exclusive`) marks a listing as high-value and needing
**extra, cross-team effort** — from Sales, Marketing, Listing Support, and Owner Talk.
Today the tag is display-only. This feature turns it into an actionable, editable
**value-add checklist** attached to each high-value listing.

Origin: client request to (a) store **documents** on a listing and (b) track the
**date it must be posted to Facebook** — generalized into an editable checklist template
so more value-add steps can be added over time.

---

## 2. Concepts

- **Checklist template** — a reusable, editable list of steps, managed in Settings.
  Each template has an **"Applies to"** setting: `A List`, `Exclusive`, or both.
- **Checklist item** — one step in a template. Has a **type** and a **default role**.
  - `task` — simple check-off (e.g. "Facebook Marketplace")
  - `document` — attach/store a file (e.g. "Title deed") → Supabase Storage
  - `date` — set a one-time due date, get a countdown reminder
  - `link` — paste a URL (copywriting template, portal post link) → done when present
  - `cadence` — a **re-post tracker**: stamp the last-posted date + "re-post every N days";
    goes **overdue/red** past the window. Mirrors the Listing Support sheet's group-post rule
    (`TODAY − date > 6 → red`). Default N = 6.

These types are derived from the real **"A LIst Post 2"** tab of the Listing Support sheet
(Google Sheet `1y9fdkBpBj9e0JNPgfMCI28x_65p8Q9AXLpx6c55VHg4`). Column mapping:

| Sheet column | Type |
|---|---|
| Date A List | listing metadata (card header), not an item |
| Template Link | `link` |
| Market Place, Profile | `task` |
| Group, Group Boost | `cadence` (6-day) |
| DD, LV, PropertyHub | `link` |
- **Listing checklist** — the live view on a listing tagged A-List/Exclusive. It is the
  union of items from every template whose "Applies to" matches the listing's `potential`,
  with per-listing state (checked / file / date) saved against each item.

The "1 checklist vs 2" question is **configuration, not code**: two templates each scoped
to one tier = separate lists; one template scoped to both = shared list. An Exclusive
listing shows every template that includes `Exclusive`, so the recommended setup is:

- **"Standard value-add"** → applies to `A List` + `Exclusive`
- **"Exclusive extras"** → applies to `Exclusive` only

An Exclusive listing then shows both lists combined; an A-List listing shows only the first.

---

## 3. Phasing

| Phase | Scope | Notes |
|-------|-------|-------|
| **0. Data cleanup** | Normalize `potential` vocabulary | Prerequisite; small |
| **1. Filter** | A-List / Exclusive filter chips on listings | Cheap; foundation |
| **2. Checklists** | Templates + per-listing checklist + role assignment + reminders | The main feature; first DB writes |

Phases 0–1 are worth doing regardless of how far Phase 2 goes.

---

## 4. Phase 0 — Normalize the `potential` vocabulary

Source data has a messy value: `A List + Fb add` (1 row). Controlled values should be:

```
Exclusive  >  A List  >  Normal
```

- Add a governed `POTENTIAL` vocabulary to `lib/masterdata.ts` and wire it into
  `MasterDataProvider` (mirror `PROPERTY_TYPES`).
- Migrate `A List + Fb add` → `A List` (the "Fb add" detail belongs in a note/field, not
  the grade).
- Constrain the intake form to the controlled values.

Priority ordering already exists in `lib/status.ts` `potentialTone()`.

---

## 5. Phase 1 — Filter chips

On `components/ListingsBrowser.tsx` (and optionally `CompanyListings.tsx`), add a second
row of filter chips next to the existing status chips:

```
[ All ] [ Exclusive ] [ A-List ]
```

- Exact-match on the normalized `potential` value.
- Keep the colored pills visible in the "All" view so high-value listings stand out.
- Default sort already surfaces them via `potentialTone`.

---

## 6. Phase 2 — Data model (eventual wire-later target)

Built as design-first in-memory state now (see banner at top). The DDL below documents the
**eventual Supabase shape** so the UI is designed against the right structure — it is the
"wire later" target, not built in this phase. Three tables + one Storage bucket when wired.

```sql
create type checklist_item_type as enum ('task', 'document', 'date', 'link', 'cadence');

-- Template definition (edited in Settings)
create table checklist_template (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  applies_to  text[] not null default '{}',   -- e.g. {'A List','Exclusive'}
  is_active   boolean not null default true,   -- soft delete (app convention)
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table checklist_template_item (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid not null references checklist_template(id) on delete cascade,
  label         text not null,
  item_type     checklist_item_type not null default 'task',
  default_role  text,               -- rbac role id: 'agent','marketing','listing_support',...
  sort_order    int not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Per-listing state (live-join model: only rows that have been touched exist)
create table listing_checklist_item (
  id               uuid primary key default gen_random_uuid(),
  listing_id       text not null,     -- matches v_main_listing.listing_id
  template_item_id uuid not null references checklist_template_item(id) on delete cascade,
  assigned_role    text,              -- defaults from template item; per-listing override
  completed_at     timestamptz,       -- null = not done
  completed_by     text,              -- user id (requires identity — see §11)
  due_date         date,              -- for item_type='date' (e.g. FB post date)
  document_path    text,              -- Supabase Storage object path (item_type='document')
  document_name    text,
  note             text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (listing_id, template_item_id)
);
```

**Storage:** bucket `listing-docs`, object path `{listing_id}/{template_item_id}/{filename}`.

### Listing focus-tier metadata (columns on the listing, not checklist items)

Two per-listing dates are tier metadata, held in `ChecklistProvider` now (in-memory), wired
later as columns on the listing (or a small `listing_focus_meta` table keyed by `listing_id`):

| Field | Tier | Meaning | UI |
|---|---|---|---|
| `a_list_date` | A-List | when it entered A-List ("Date A List" from the sheet) | checklist card header |
| `agreement_start` | Exclusive | signed exclusive-agreement effective date | `ExclusiveAgreementCard` (sidebar) |
| `agreement_end` | Exclusive | agreement expiry = the sell-by commitment deadline | same card; drives the expiry pill |

`agreement_end` is the one with teeth — it's the deadline we commit to the seller. The card
shows a red/amber/green "days left" pill; wire-later it should feed a dashboard "expiring soon"
reminder (renew or delist) alongside the `date`-item reminders in §10.

### Live-join, not snapshot

The checklist shown on a listing is computed at read time:

```
templates where is_active and applies_to overlaps [listing.potential]
  -> their active items
  -> LEFT JOIN listing_checklist_item on (listing_id, template_item_id)
```

Rationale: **single source of truth** for the template (matches how MasterDataProvider
already propagates edits). Editing a template updates every listing instantly. Deleting an
item is a soft delete (`is_active=false`) so historical progress isn't orphaned — it just
stops appearing. New items appear automatically on all matching listings.

Tradeoff vs snapshotting: a live-join means a template edit *does* retroactively change
in-flight listings. That's the desired behavior here ("we improved our process → apply it
everywhere"). If you ever need a listing to freeze its checklist, that's a future
`snapshot` flag, not a v1 concern.

---

## 7. Phase 2 — Settings: Checklist Template editor

Add to `components/SettingsView.tsx` `SECTIONS`:

```ts
{ key: "checklists", label: "เช็คลิสต์ทรัพย์", icon: <...>, perm: "checklists.manage" }
```

New manager component modeled on `TeamsManager.tsx` (parent + sub-items). Per template:

- Name field
- **Applies to:** ☐ A-List ☐ Exclusive
- Item list — each row: label, type dropdown (Task / Document / Date), **assigned role**
  dropdown (from rbac roles), reorder, soft-delete
- Add / edit / delete template (with `ConfirmDelete`, per app convention)

Live store: new context provider mirroring `MasterDataProvider` / `RbacProvider`, mounted
in `app/layout.tsx`.

---

## 8. Phase 2 — Listing detail: Checklist card

New `<Card>` in the main column of `app/listings/[id]/page.tsx` (same structure as the
activity timeline card). Only renders when `potential` ∈ {A List, Exclusive}.

```
Checklist — Exclusive                          4 / 7 done  ▓▓▓▓░░░
─────────────────────────────────────────────────────────
✅  Owner talk done                    · Sales
✅  Photos taken                       · Listing Support
📄  Title deed              [deed.pdf ✓]  · Listing Support
📄  Owner ID                [ upload ]     · Listing Support
📅  Post to Facebook        [28 Jul 2026] ⏰ in 4 days  · Marketing
📅  Boost / re-post         [ set date ]   · Marketing
☐   Premium photoshoot                 · Marketing   (Exclusive-only)
```

- Progress bar across all items.
- Each item shows its **assigned role** as a chip.
- Items can be filtered/grouped by role ("show only Marketing's items").
- Interacting writes a `listing_checklist_item` row (upsert on `(listing_id, template_item_id)`).

---

## 9. Phase 2 — Role assignment

- Each template item carries a `default_role` (one of the rbac role ids).
- A listing item inherits it into `assigned_role`, overridable per listing.
- Roles are the real ones from `lib/rbac.ts`: `agent` (Sales), `marketing`,
  `listing_support`, `sales_leader`, `ceo`.
- v1: role is a **visual grouping + filter**. Hard enforcement (only Marketing can tick
  Marketing's items) waits on real auth (§11).

---

## 10. Phase 2 — Reminders

`date`-type items with a `due_date` surface in a **dashboard "Upcoming"** card:

- Query `listing_checklist_item` where `due_date` is set, not completed, ordered soonest-first.
- Links back to the listing.
- v1 = in-app list only. Push/email/LINE notifications are a later add-on.

---

## 11. Identity / auth — deferred (does not block design-first UI)

Persisting *who* assigned or completed an item needs to know the current user. Today
identity is **seeded in-memory** (`SEED_USERS` in `lib/rbac.ts`) with **no real login**,
and the Supabase client is a **read-only anon client** (RLS `demo_read_all`).

Because this feature is being built **design-first** (§ banner), the UI simply uses the
in-memory seeded user for `completed_by` / `assigned_by`, exactly like the rest of the app.
**No auth decision is needed to build the UI.**

When the app later wires real persistence, this resurfaces as a genuine choice: real
Supabase Auth with RLS keyed to the rbac role model (`DATA_MODEL.md:282-383`) is the
production-correct path. Recorded here so it isn't forgotten, but it is **out of scope for
the design-first build.**

---

## 12. Permissions to add (`lib/rbac.ts`)

- `checklists.manage` — govern templates (Settings). Grant to `ceo`, `listing_support`.
- `checklists.update` — tick items / attach docs / set dates on a listing. Grant broadly
  (anyone with `listings.view`), or scope to assigned role once auth lands.

---

## 13. Open items for confirmation

Auth (§11) is deferred and no longer blocks. Remaining are UI/design decisions:

1. Who governs templates — `listing_support` only, or `ceo` too?
2. Reminders v1 — dashboard "Upcoming" list only? (push/LINE later)
3. Per-listing role override (§9) — needed, or template default only?
4. Document items — in-browser preview only for the design phase (not persisted), confirmed?
