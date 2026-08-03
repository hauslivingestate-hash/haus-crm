# HAUS CRM — CEO Feedback Round 1

**Source:** CEO app review, relayed by Ben — 2026-07-29
**Status:** ✅ **All 4 items BUILT** (2026-07-29). Remaining work is the deferred tier of
item 2 (§2.3 — the 15 sheet columns the view doesn't expose yet) plus the known gaps listed
under item 4.
**Doc convention:** same as `PROBATION_FEATURE.md` / `CHECKLIST_FEATURE.md` — design-first
UI, DB wiring called out per item.

---

## Summary table

| # | Feedback (CEO) | Scope | Blocked on a decision? |
|---|---|---|---|
| 1 | Lead Group Tag → บริษัทกำหนดมาตรฐาน ไม่ใช่ tag ส่วนตัว | Settings section + tag model change | ✅ **BUILT** 2026-07-29 |
| 2 | เอา field จากชีท Listings มาใส่ | Listing detail + intake/edit form | No — but see the 15-field gap in §2.3 |
| 3 | Last Match ของตัวเองเท่านั้น | RBAC scoping on `/last-match` | ✅ **BUILT** 2026-07-29 |
| 4 | เอา FAB Action ออก ใช้ Daily Plan + Quick Add แทน | Removes the only activity write-path | ✅ **BUILT** 2026-07-29 |

---

## 1. Lead Group Tag → company standard, governed in Settings

### What the CEO said
> ให้มี Standard ที่ใช้กันทุกคนไปเลย

Ben's read: move it from a personal-preference free-form tag to a **governed vocabulary**
like pipeline stage / property type — only CEO (or a role the CEO grants) can change the list.

### Current state
`lib/tags.ts` — explicitly built as **free-form**: any user creates a tag on the fly, the
pool is `SEED_TAGS` ∪ whatever users typed, colour is hash-derived from the label, and the
whole thing is local `useState` in `components/LeadsBrowser.tsx` (lines 117–135). The
`TagPopover` has a "create tag" input path. Nothing is persisted.

**DB check (live):** `main_6_buyer_crm` has **no tag/group column** — confirmed by querying
the live table. Tags are a genuinely new concept, not a column we forgot to read. The
closest existing field is `lead_type` (`Buyer - Buy` / `Buyer - Rent`), which is a different
axis (what they want, not who they are).

### The change
1. Tags become a **`RefItem[]` in `MasterDataProvider`** — same pattern as property types /
   contact-by / nationality. This is the established shape; no new architecture.
2. New **Settings section "แท็ก Lead"** in `components/SettingsView.tsx` `SECTIONS`, driven
   by the existing `MasterDataManagers` component.
3. `LeadsBrowser`'s `TagPopover` loses the create-new path for non-privileged users — it
   becomes a picker over the governed list only.
4. Delete `SEED_TAGS`' free-form framing + `seedTagState`'s pool-union logic from
   `lib/tags.ts`; keep `tagTone` only if we stay with derived colours (see Q1.3).

**Permission — recommendation:** reuse **`masterdata.govern`** (already CEO-only,
already the gate for zones / activity types / KPI templates / ranks). The CEO can grant it
to any role from Settings → บทบาท & สิทธิ์, which is exactly "CEO or approved role."
Alternative: a dedicated `tags.manage` key if the CEO wants to delegate tags *without*
handing over zones and KPI templates. I'd start with `masterdata.govern` and split later
only if asked — a third master-data permission fragments an already 3-way split
(`masterdata.govern` / `reference.manage` / `checklists.manage`).

**Wire later:** ONE FK column `main_6_buyer_crm.tag_id` → `lead_tags_ref(id, label, colour,
sort_order, is_active)`. **No join table** — Q1.1 landed on single-select.

### ✅ Q1.1 ANSWERED — one tag per lead (CEO via Ben, 2026-07-29)
> "ติดได้คนเดียว"

Single-select. Consequences, all simplifications:
- Schema is one FK column, not a join table.
- UI is a **dropdown / radio**, not a chip multi-picker. `LeadsBrowser`'s `TagPopover`
  becomes a single-choice list; the `tags` table cell renders at most one chip.
- **"จัดกลุ่มตามแท็ก" in the leads table now produces clean, non-overlapping buckets** —
  currently `groupBy` puts one lead in several groups at once
  (`components/LeadsBrowser.tsx:163–174`). That whole branch gets simpler and the row counts
  finally add up to the total.
- `seedTagsForLead` (returns 0–3 tags) is replaced by a single value or null.

### ⏳ Q1.2 — CEO will define the real list; seed 3–4 now (Ben, 2026-07-29)
> "เดี๋ยวให้ CEO เค้าเซ็ทเอา seed มาไวๆสัก 3-4 อันก่อนก็ได้"

⚠️ **Don't seed a hot/warm/cold ladder.** The lead already has `potential` (A / B / C) doing
exactly that grading — the Buyer Focus tab's conditional formatting keys off it (`$D2="A"` →
red after 7 days, `$D2="B"` → after 15). A second temperature field would compete with it.

A single-select "group" should be a **different axis** — what kind of buyer this is.
Proposed seed (CEO overwrites in Settings):

`นักลงทุน` · `ซื้ออยู่เอง` · `ปล่อยเช่า` · `ต่างชาติ`

These are mutually exclusive, which single-select requires. The old `SEED_TAGS` list mixed
axes (`ร้อน` temperature + `นักลงทุน` type + `รอเงินกู้` status) and only worked because it
was multi-select — it must be replaced, not trimmed.

### ✅ BUILT 2026-07-29

- **`lib/tags.ts` rewritten.** Free-form multi-tag model gone. New shape: `LeadTag {id,
  label, tone}`, a `SEED_LEAD_TAGS` placeholder list, `seedTagForLead` (returns **one** tag
  or null), and `findTag` for resolving a stored id against the live list.
- **`MasterDataProvider`** gains `leadTags` / `setLeadTags` — the shared live store, same
  pattern as property types. Deleting a tag in Settings immediately removes it everywhere.
- **Settings → แท็ก Lead** (`LeadTagsManager`), gated **`masterdata.govern`** (CEO-only;
  the CEO can delegate by granting that permission to a role). Rename, reorder-free add,
  delete-with-confirm, plus a **6-swatch colour picker per tag** and a live "ตัวอย่างที่เซลส์เห็น"
  preview. Q1.3 answered in the build: colours are **stored**, not hash-derived.
- **`LeadsBrowser`** — the tag cell is now a **single chip** (tap to change) or an empty
  "+ แท็ก" button. `TagPopover` is a **picker with no create path**; it offers only the
  governed list, plus "เอาแท็กออก". Picking a tag replaces the previous one and closes.
- **Grouping is now correct.** With one tag per lead the buckets are **disjoint**, so group
  counts finally sum to the row total — under the old model a lead was duplicated into every
  group it carried. Group order follows the CEO's list order in Settings, not row count.
- A tag deleted in Settings resolves to `null` in the table rather than rendering a
  phantom chip.

Verified: `tsc --noEmit` clean, `next build` clean, `/leads` + `/settings` 200, no stale
references to the old API (`tagTone` / `SEED_TAGS` / `seedTagsForLead` / `toggleTag` /
`createTag` all gone).

⚠️ **Known gap, not built:** the tag is visible and settable only in the **leads table**.
The lead detail page (`/leads/[id]`) doesn't show it. For a company-standard field that's a
real hole, but adding it was outside the CEO's ask — flag for the next round.

### Open questions
- **✅ Q1.3 — ANSWERED IN BUILD.** Governed tags usually want **meaningful, CEO-chosen colours**
  (ร้อน = red, เย็น = blue) rather than the current hash-derived ones. Add a colour picker
  to the Settings manager? My recommendation: yes — it's the point of a standard.
- **Q1.4 (minor).** Can a sale still *request* a tag, or is it purely top-down? Purely
  top-down is simpler and matches "ใช้กันทุกคนไปเลย".

**Effort:** small–medium. The Settings + provider pattern is copy-paste from property types;
the real work is whichever answer Q1.1 gives.

---

## 2. Listing fields — pull the rest of the sheet in

### What the CEO said
> เอา field จากชีท Listings มาใส่

### The actual gap — and the good news

I read both the sheet and the live DB. **The DB is far ahead of the app.**

- Sheet `Listings` tab: **61 columns** (already fully documented in `DATA_MODEL.md` §1).
- Live `v_main_listing` view: **55 columns**.
- What the app selects in `lib/queries.ts` (`ListingRow`): **17 columns**.

So **38 fields are already sitting in the live view, with real data, unused.** No migration,
no schema work, no stubbing — item 2 is mostly a `select(...)` change plus UI to render it.

**2.1 — ✅ BUILT 2026-07-29.** `ListingRow` + both queries now read **all 55 columns**
(`lib/queries.ts`, single `LISTING_COLUMNS` constant shared by `getListings`/`getListing`).
Column types were probed against the live schema rather than inferred from the sample rows
(most are null there) — `floor` and `unit_no` are genuinely TEXT, `parking` is an integer,
`sign`/`vdo`/`owner_focus` are booleans, the three `*_date` columns are dates.

Surfaced on `app/listings/[id]/page.tsx`:
- **การตลาด card is real** — was a "เร็ว ๆ นี้" pill over three hardcoded `—` rows. Now shows
  a posted-portal count, per-portal links (DDproperty / Livinginsider + its date /
  PropertyHub), and chips for ป้าย · วิดีโอ · Reels · Hometour · แผนที่.
- **New ข้อมูลทรัพย์ card** — land area (ไร่-งาน-วา via `formatLandArea`), unit no., floor,
  building, direction, view, position, condition, ใน/นอกโครงการ, road/soi, remark. Empty
  fields render nothing rather than a dash.
- **New ประวัติราคา card** — old → new price with a computed %-change pill, update remark,
  price conditions. Conditional: hidden unless there's history. ⚠️ **Not verified against
  real data** — every live demo row has `old_price`/`new_price` null.
- **Spec strip** gains parking. **Sidebar** gains listing type, created date, managing agent,
  Owner Focus. **Owner card** gains LINE, last owner-talk date, and that conversation's note.

Verified: `tsc --noEmit` clean, `next build` clean, all routes 200.

**The 38 fields that were sitting unused.** Grouped as they appear in the UI:

| Block | Live columns not yet used |
|---|---|
| Marketing / portal | `sign`, `vdo`, `ddproperty_link`, `livinginsider_link`, `livinginsider_date`, `propertyhub_link`, `shorts_reels_link`, `hometour_link` |
| Pricing history | `old_price`, `new_price`, `update_remark`, `price_remark` |
| Specs | `unit_no`, `in_out_project`, `road_soi`, `area_rai`, `area_ngan`, `area_wa`, `floor`, `building`, `direction`, `view_type`, `unit_position`, `parking`, `unit_condition` |
| Owner | `owner_line`, `owner_talk_last_date`, `activity_comment` |
| Meta / links | `date_created`, `owner_focus`, `remark`, `link_location`, `created_by`, `project_id`, `owner_id`, `zone_name_eng`, `created_at`, `updated_at` |

This immediately makes three placeholder surfaces real:
- The **การตลาด card** on listing detail (`app/listings/[id]/page.tsx:351–368`) is currently
  a "เร็ว ๆ นี้" pill over three hardcoded rows with `—`. With `ddproperty_link` /
  `livinginsider_link` / `propertyhub_link` it becomes a working portal-status block.
- **`lib/listings.ts`** exists *only* because the app didn't read `created_by` — it fakes a
  managing agent with a hash. The column is in the view. ⚠️ **Caveat:** it's `NULL` in the
  live demo rows (the sheet has it populated with "Stone"), so the seed can't be deleted
  until the import backfills it. Flag for the import phase.
- **Owner card** gains `owner_line` + `owner_talk_last_date` (last owner contact — a real
  follow-up signal, and the Buyer Focus tab already has conditional formatting that goes red
  when owner talk is stale).

**2.2 — Extras the view has that the sheet doesn't:** `building`, `view_type`,
`livinginsider_date`, `propertyhub_link`, `project_id`, `owner_id`, `zone_name_eng`. Someone
already normalized beyond the sheet. Worth confirming these are intentional before rendering.

**2.3 — In the sheet, NOT in the view (15 fields).** These need the view extended (or the
base table backfilled) before they can be shown:

`Last Match Price` · `Last Match Remark` · `Hook` · `อายุ` (age) · `ส่วนกลาง` (common fee) ·
`Photo Album Link` · `Link` · `Last Match` · `Last Match Type` · `New Photo (Link)` ·
`Facebook Ad (Doc Link)` · `DD Boost` · `LV Boost` · `FB Repost` · `Marketing Report`

Note most of these are **marketing-ops fields** (boosts, reposts, report) — i.e. the block
the CEO most likely means. This is the only part of item 2 that needs DB work.

### Design recommendation (not a question — stating the assumption)
Do **not** put 61 fields in the intake form. Keep `ListingForm` short (what a sale knows at
sourcing — it's already the right 15 fields) and put the full set behind the **แก้ไข** button
on listing detail, which is currently `disabled` (`app/listings/[id]/page.tsx:90`). Full edit
= a sectioned form matching the blocks above. Detail page grows a **ข้อมูลทรัพย์** card
(specs), a **ประวัติราคา** card (old→new + remarks), and the marketing block becomes real.

Gate the marketing block's *edit* to `listings.marketing` (Marketing / Listing Support) —
that permission already exists and DD Boost / LV Boost / FB Repost / Marketing Report are
not a sale's job. Everyone with `listings.view` still *sees* it.

### Open questions
- **Q2.1.** Extend the view for the 15 missing fields now, or ship the 38 first? My
  recommendation: **ship the 38 first** (zero DB risk, immediate visible win), extend the
  view in the same pass as the import normalization work already listed in `DATA_MODEL.md`
  → "Import / normalization must-fixes".
- **✅ Q2.2 DECIDED — both become numeric** (Ben delegated the call, 2026-07-29). I read the
  full `Listings!AM:AN` range first; the problem is worse than "text instead of number."

  **`ส่วนกลาง` (col AN) holds three incompatible units in one column:**

  | Form in the sheet | Actually means | Rows |
  |---|---|---|
  | `45 บาท`, `28 บาท`, `71 บาท`, `20 บาท`… | **rate** per ตร.ว. per month | the large majority |
  | `44,000` · `39,960+3,780=43,730` | **total per year** | 2 |
  | `เดือนละ 2,024` | **total per month** | 1 |

  Verified by arithmetic: HRP1001 is 120.5 ตร.ว. with `44,000` → 120.5 × 30 × 12 = 43,380.
  Same quantity, three notations.

  **Decision: store the RATE.** `common_fee_rate` (numeric) + `common_fee_unit`
  (`per_wa_month` | `per_sqm_month` — condos are quoted per ตร.ม., houses per ตร.ว.). The
  3 absolute-total rows get back-converted at import. The app displays both, deriving the
  total from the matching area column: `45 บาท/ตร.ว./เดือน · ≈ ฿5,400/เดือน`.
  Rationale: the rate is the only form comparable across properties, and it is already what
  ~90% of the rows contain. Keep the original string in `common_fee_note` so nothing is lost.

  **`อายุ` (col AM) → store `built_year`, NOT age.** Every value is the same `"N ปี"` shape,
  so parsing is trivial — but *age is a decaying fact*. "15 ปี" is wrong next year and no one
  will ever update it; across a CRM where listings sit for months and get re-listed, every
  row silently drifts. Year built never changes; age is computed for display.
  **Tradeoff, stated:** back-computing `built_year` from age + `date_created` is ±1 year
  imprecise for the ~40 existing rows. That is a one-time error on old rows versus permanent
  drift on every row forever. Accepted.
  **Also changes intake:** the listing form should ask **ปีที่สร้าง**, not อายุ — easier for
  a sale to get right from the owner, and self-maintaining.

  Neither column exists in `v_main_listing` yet, so this lands with the §2.3 view extension.
- **Q2.3.** Which of the new fields should be **filterable/sortable** in the listings table
  vs. detail-only? Adding all 38 to the table would be unusable. My default: detail-only,
  and we add table columns on request.

**Effort:** medium. §2.1 is mechanical and high-value. The full edit form is the real work.

---

## 3. Last Match — own records only

### What the CEO said
> เซลล์ต้องเห็นของตัวเองได้เท่านั้น ไม่มีสิทธิ์เห็น last match ของคนอื่นในบริษัท

### Current state
- `/last-match` (`app/last-match/page.tsx` → `components/LastMatchBrowser.tsx`) shows
  **every** row, with a `sale_id` column and a sort-by-agent header. Directly contrary.
- Data is **sample** (`lib/lastMatch.ts`), but the live table **`main_7_last_match` exists**
  with a `sale_id` column — so the scoping filter is real and wireable, not hypothetical.
- Nav gate today is `perm: ["listings.view", "lastmatch.add"]` (`lib/nav.ts:74`) — no
  view-scope permission exists at all. RBAC has only `lastmatch.add`.

### The change
### ✅ BUILT 2026-07-29

1. **Three permissions** in `lib/rbac.ts` (inventory group): `lastmatch.view_all` /
   `lastmatch.view_team` / `lastmatch.view_own`. Seeded matrix — **Agent → own**,
   **Sales Leader → team**, **CEO + Listing Support → all**, **Marketing / Admin / HR →
   none**. (Marketing gets nothing rather than `view_own`: they close no deals, so an
   own-scoped page would always be empty. Consistent with actions being sales-only.)
2. **`matchScope(can)` + `scopeMatches(matches, codes)`** in `lib/lastMatch.ts`. Widest
   scope wins, so a player-coach holding Agent + Sales Leader resolves to `team`.
3. **`LastMatchBrowser`** resolves the scope from `useRbac()`, maps user ids → employee
   codes (`getEmployee(id).code`, the `S-00x` values the ledger's `sale_id` stores), and
   reuses the existing `visibleMemberIds()` team helper. Own-scoped viewers **lose the
   เซลส์ column and its sort** — a column repeating your own name is noise. No-scope
   viewers get a "ไม่มีสิทธิ์ดู Last Match" card.
4. **Nav gate changed** (`lib/nav.ts`) from `["listings.view","lastmatch.add"]` to the three
   view scopes, so the page disappears entirely for roles with no scope.
5. **Removed the row count from the page header.** It was server-rendered
   (`${matches.length} รายการ`) while scoping is client-side — an own-scoped sale would have
   been shown the company-wide total. The scoped count lives in the filter chips instead.

**Verified** with an assertion script over the real seed data (12 rows, S-001…S-004):

| Viewer | Scope | Rows | Sees |
|---|---|---|---|
| Stone (CEO) | all | 12 | S-001–004 |
| Pup (leader, team A) | team | 9 | S-001, S-003, S-004 |
| Game (leader, team B) | team | 3 | S-002 |
| Q (agent) | own | 3 | S-003 |
| Pui (marketing) | none | 0 | — |

Asserted: an agent sees only their own closes; a leader sees their team but **not** the
other team; no-scope sees nothing; widest scope wins. All passed. `tsc` + `next build` clean.

⚠️ **Client-side filtering is convenience, NOT enforcement** — every row still reaches the
browser. Wire later = **RLS on `main_7_last_match`** keyed on the authenticated user's
employee code. Same caveat `lib/rbac.ts` already states for the whole matrix.

### ✅ Q3.1 RESOLVED — the comparables panel is REMOVED (Ben, 2026-07-29)
> "I don't know when did the ทรัพย์เทียบเคียง come.. actually I didn't want it though"

**Origin: not a requirement.** The ทรัพย์เทียบเคียง panel on listing detail was introduced by
me alongside the Last Match sample data (see the header comment in `lib/lastMatch.ts` — "so
the comps panel on listing detail populates"). It was never asked for by Ben or the CEO. It
is standard practice in real estate (comparative market analysis — price a listing off recent
nearby closes), but here it was speculative, the data behind it is thin, and it was the
*only* thing that conflicted with the CEO's privacy directive.

**Removed:**
- the ทรัพย์เทียบเคียง `Card` block in `app/listings/[id]/page.tsx`
- `getComparables()` in `lib/lastMatch.ts` (had no other caller)
- the now-unused `Handshake` / `closeTypeTone` / `sizeSummary` imports on the detail page

`/last-match` (the ledger page) **stays** — the CEO's feedback is about scoping it, not
deleting it. `sizeSummary` and `closeTypeTone` remain in `lib/lastMatch.ts` for
`LastMatchBrowser`.

**Consequence: item 3 has no conflict left.** It is now purely a scope filter on one page —
the smallest item in this round.

**If pricing support is wanted later,** design it deliberately with the CEO rather than
reinstating my guess. The privacy-safe shape would be company-wide prices with the closing
agent's name stripped.

### Open questions
- **✅ Q3.2 ANSWERED — Sales Leader sees the whole team** (CEO via Ben, 2026-07-29):
  "หัวหน้าทีมเห็นของทั้งทีม". So the scope is 3-tier, not 2: **own** (Agent) → **team**
  (Sales Leader, via `lib/teams.ts` membership) → **all** (CEO, Listing Support). Note this
  means `lastmatch.view_all` alone isn't enough — a Sales Leader needs a *team* scope, so
  either add `lastmatch.view_team` as a third key or resolve team membership at query time
  for `view_all` holders who lead a team. Recommendation: a third key, to match how the
  matrix already reads one-scope-per-surface.
- **Q3.3.** Does the same privacy logic apply to the **dashboard leaderboard**, which
  currently shows `total_matches` / `total_match_value` per agent to everyone? `lib/rbac.ts`
  notes "the leaderboard is intentionally public." If match *counts* are public but match
  *records* are private, that's coherent — but worth confirming it's deliberate.

**Effort:** small once Q3.1 is answered. Two permissions + a filter.

---

## 4. Remove the Action FAB → Daily Plan + Quick Add

### What the CEO said
> เอา FAB Action ออก ใช้เป็น Daily Plan แทน

Plus Ben's addition: **Quick Add** — user-configurable one-tap chips that drop a common
action into today's plan, with time/description editable afterwards.

### Current state
There are **two** FABs, both mounted in `app/layout.tsx:53–55`:
- `components/LogActivity.tsx` — **บันทึก**, gated `activity.log`. The activity logger.
- `components/LeadIntakeFab.tsx` — **เพิ่มลีด**, gated `leads.create`. Lead intake, stacks
  above the first for anyone holding both.

**✅ Q4.1 ANSWERED — only เพิ่มลีด survives** (CEO via Ben, 2026-07-29): "FAB เหลือแค่เพิ่มลีด".
So `components/LogActivity.tsx` is deleted and unmounted from `app/layout.tsx:53`;
`LeadIntakeFab` stays. Its `bottom-[76px]` / `bottom-5` stacking logic keyed on
`can("activity.log")` (`LeadIntakeFab.tsx:28`) becomes dead — it always sits at `bottom-5`.

⚠️ **Order of work:** land the Daily-Plan → activity write bridge FIRST, verify it, then
delete `LogActivity`. Deleting first leaves the CRM with no way to record activity at all,
which silently freezes KPI targets, the probation ladder, entity timelines, and the
leaderboard.

### ⚠️ What the FAB is actually load-bearing for
The activity log is not a diary — it is the **input to four systems**:
1. **KPI targets** (`lib/momentum.ts`) — `source: "activity"` targets compute `current` live
   from the log.
2. **The new-sales probation ladder** (`PROBATION_FEATURE.md`) — ranks are *derived* by
   tallying `Call` / `Survey` / `Show` counts out of the log. No log → nobody promotes.
3. **Entity timelines** — the กิจกรรมล่าสุด block on listing detail and lead detail.
4. **The dashboard leaderboard.**

Deleting the FAB without a replacement write-path breaks all four. So this item is **not a
deletion, it's a migration**: the Daily Plan's completion tick has to become the write.

### The good news — the bridge is already designed
`Task` in `lib/momentum.ts:80–85` already carries exactly the fields an activity row needs:

```ts
/** CRM activity logged on completion (drives the auto-bridge). */
activityType?: string;
relatedLeadId?: string;   relatedLeadName?: string;
relatedListingId?: string; relatedListingName?: string;
```

`TaskDetailSheet` already captures them. So "tick the task → write the activity row" is the
intended design, just not implemented. This feedback is asking us to *finish* it and make it
the only path.

### What's genuinely missing vs. the FAB
The FAB captures three things a checkbox can't:

| FAB capability | Daily Plan today | Fix |
|---|---|---|
| **Count N** (e.g. `Sourcing ×3`, `Call ×12`) — the bulk-tally path new sales rely on | A task is 1 or 0 | Ticking a task with `activityType` opens a light confirm sheet with a count stepper (default 1) |
| **Back-dating** ("I did this Tuesday") | Plan date = task date | Navigate to that date and add an already-done task — works, but needs the tick to write with the *task's* date, not today's |
| **Unplanned work** — most real activity | Must add-then-tick | Quick Add chips make this 2 taps; acceptable |

### Quick Add — spec
- A row of **chips above the add-task input** in `components/DailyPlan.tsx`, e.g.
  `+ โทรหาลูกค้า` · `+ พาชม` · `+ เยี่ยมเจ้าของ` · `+ ถ่าย Reels`.
- Each chip = a saved preset: `{ label, taskType, activityType?, targetId?, defaultTime? }`.
  Tapping it appends a task to the selected day; the user opens it later to set time / detail
  / linked lead or listing. Exactly Ben's description.
- Presets come from the existing catalogs — `ACTION_GROUPS` (`lib/actions.ts`) for the
  activity binding and `TASK_TYPES` for the สร้างยอด / พื้นฐาน / ส่วนตัว badge. **No new
  vocabulary**; a chip is a shortcut over things that already exist.
- **Per-user**, edited inline from the Daily Plan (a pencil next to the chip row), not in
  company Settings — it's a personal preference, matching "set it themselves."
- Wire later = `user_quick_actions(user_id, label, task_type, activity_type, target_id,
  sort_order)`.

### Considered and rejected — role-scoped actions

Question raised: should each role get its own add/edit-able action list, so every position
has a Daily Plan wired to actions that fit their job?

**No — the premise doesn't hold here.** All 23 actions in `ACTION_GROUPS` are **sales**
actions, including `ถ่ายรูป` and `Reels`, which look like Marketing's job but are done by
the sale in this company (Ben, 2026-07-29). There is nothing to scope. Non-sales roles still
get a Daily Plan — it's just an ordinary to-do list, since a `Task` with no `activityType`
logs nothing. Already supported: seeded tasks `k4` ("อัพเดทพอร์ทัล Rama 2") and `k5`
("ออกกำลังกาย") have no action attached. **Nothing to build.**

Recorded because if it comes up again, the answer would be **one shared catalog with a
role tag per action — never a separate list per role.** The action name is the join key
across the activity log, KPI target `activityType`, probation rank criteria, entity
timelines, and the `v_sale_status` leaderboard. Per-role catalogs would let `ถ่ายภาพ` and
`ถ่ายรูป` coexist and never reconcile — the same vocabulary drift `DATA_MODEL.md` →
"Import / normalization must-fixes" is already paying to clean up.

**Trigger to revisit:** item 2 adds `DD Boost` / `LV Boost` / `FB Repost` /
`Marketing Report` as listing fields. If that work should ever be *logged* rather than just
recorded, non-sales actions become real and the role tag earns its place.

### ⚠️ Fix out of this: Marketing shouldn't hold `activity.log`

`lib/rbac.ts:194` justifies the grant as "sales, marketing (**Reels/content**), sales leader,
CEO." That parenthetical is wrong — the sale shoots the Reels. Marketing (Pui) holds
`activity.log` on a false premise and has no action in the catalog it would ever log.

**Change:** remove `"activity.log"` from the `marketing` role in `SEED_ROLES`
(`lib/rbac.ts:269`) and correct the rationale comment at line 194. Mirror it in
`DATA_MODEL.md` → "Seeded role matrix". One-line change; do it with item 4 so the FAB
removal and the permission cleanup land together.

### ✅ BUILT 2026-07-29

Order was deliberate: **the write bridge landed and was verified BEFORE `LogActivity` was
deleted**, so the CRM was never left without a way to record activity.

- **`components/ActivityProvider.tsx` (new)** — the live activity log, seeded from the
  sample rows. `logActivity` / `removeActivity` / `activitiesBy`. The old static
  `listActivities()` array had nowhere to write; this is that place.
- **Task → activity bridge** in `DailyPlan`. Ticking a task that carries an `activityType`
  writes an activity row; un-ticking removes it, so a mis-tick leaves no phantom. The row's
  id is derived from the task id (`taskActivityId`), which makes re-ticking idempotent.
  The activity is dated to the **task's** date, so ticking a back-dated plan item logs it
  on that day rather than today.
- **`components/TaskCompleteSheet.tsx` (new)** — the confirm that preserves what a bare
  checkbox would have lost: **count N** (the bulk tally new sales depend on) and **remark**.
  Action / lead / listing / date are already on the task, so it stays a two-field confirm
  rather than re-asking the whole FAB form. Entity-attached tasks are one event (no count),
  matching the old FAB's rule. Tasks with no `activityType` skip the sheet and just tick.
- **Quick Add** (`lib/quickAdd.ts` + chip row in `DailyPlan`) — one tap drops a common task
  into the day. **Per-user**, persisted to localStorage per agent, edited inline via the
  pencil (Q4.4's Settings-level default was not built — see below). A chip bound to an
  action logs on completion; an unbound chip is a plain to-do. Presets reuse
  `ACTION_GROUPS` + `TASK_TYPES` — **no new vocabulary**.
  Q4.2 answered in the build: a chip adds an **unticked** task. It's a plan; the tick logs.
- **`LogActivity.tsx` DELETED** and unmounted. `LeadIntakeFab` loses its
  `can("activity.log") ? "bottom-[76px]" : "bottom-5"` stacking — it's the only FAB now.
- **Downstream readers switched to the live log** so the bridge is actually visible:
  `TargetsBoard` (activity-source KPIs), `NewSalesBoard` + `NewSalesDetail` (the rank
  ladder — auto-promote would have silently frozen otherwise). `tallyAction` and
  `evaluateLadder` take an optional `activities` argument, defaulting to the sample for
  non-React callers.
- **Marketing loses `activity.log`** (`SEED_ROLES`), and the false "marketing
  (Reels/content)" rationale at `lib/rbac.ts` is corrected. The permission's own label no
  longer says "(ปุ่มลอย)" — there is no FAB.

**Verified by assertion script** over the real seed data, not just a typecheck:

| Assertion | Result |
|---|---|
| Ticking a Reels task raises its KPI target | 2 → 3 ✅ |
| `count=5` adds 5, not 1 | 2 → 7 ✅ |
| Re-ticking the same task does not double-count | ✅ |
| Un-ticking restores the original value | ✅ |
| An activity dated outside the target month is excluded | ✅ |
| Logging Calls advances the new-sales ladder | 11 → 31 ✅ |
| Clearing every Rookie criterion auto-promotes | เริ่มต้น → Rookie ✅ |

`tsc --noEmit` clean; all 13 routes 200.

### ⚠️ Known gaps

1. **Entity timelines don't show newly-logged activity.** Listing detail and lead detail are
   **server** components calling `getActivitiesForListing` / `getActivitiesForLead` on the
   static sample; the provider is client-side. A just-logged activity appears in the Daily
   Plan, KPI targets and the rank ladder, but **not** on the listing/lead timeline until
   both read a real `activities` table. Documented in `ActivityProvider`'s header.
2. **Nothing persists.** The log is in-memory and resets on reload — same as every other
   design-first store here.
3. **Q4.4 not built** — no CEO-pushed default chip set. Every user starts from
   `DEFAULT_QUICK_ACTIONS` and customises. Worth revisiting alongside the probation ladder,
   which already defines which actions matter for new sales.
4. **Q4.5 not built** — the plan is still only reachable at `/today`. The FAB was global;
   if reps find navigating there friction, a topbar shortcut is the fix.

### Open questions
- **✅ Q4.2 — ANSWERED IN BUILD (unticked).** Does tapping a Quick Add chip add an **unticked** task (it's a *plan*) or
  **log it as done right now** (it's a *logger*)? Recommendation: **unticked** — the surface
  is called แผนวันนี้ and the tick is what writes the activity. Add "already done" as a
  secondary gesture later if reps ask.
- **Q4.3 — RESOLVED, no decision needed** (Ben, 2026-07-29). Nobody loses a write-path.
  `/today` is gated `["performance.view_own", "performance.view_team"]` (`lib/nav.ts:45`),
  and **every role holding `activity.log` also holds `performance.view_own`** — Agent,
  Marketing, Sales Leader, CEO. They all already reach the Daily Plan. Admin has neither,
  which is consistent. What made this look like a gap is that `lib/momentum.ts` seeds tasks
  for a single `SAMPLE_AGENT` ("Stone") — a seed-data limit, not a permission one.
- **Q4.4.** Should the CEO be able to push a **default chip set** to the team — especially
  new sales, where `PROBATION_FEATURE.md`'s ladder already defines which actions matter? A
  Settings-level default that users then customize. Nice tie-in, not required for v1.
- **Q4.5.** With the FAB gone, does the Daily Plan need to be reachable from **every** page
  (a topbar shortcut or a persistent entry), or is navigating to `/today` acceptable? The FAB
  was global; the plan is one route. Reps log throughout the day, so this matters.

**Effort:** medium–large. The activity-write bridge is the substantive piece; Quick Add is
mostly UI on top of catalogs that already exist.

---

## Cross-cutting effects (things these four touch that weren't mentioned)

- **`lib/rbac.ts`** gained three permission keys (`lastmatch.view_all` / `view_team` /
  `view_own`) and lost one grant (`activity.log` off `marketing`). ⚠️ **`DATA_MODEL.md` →
  "Seeded role matrix" still describes the OLD policy and needs updating** — it is the
  written access spec the wiring phase is supposed to reproduce in RLS.
- **`HANDOVER_CHECKLIST.md`** has entries for the FAB logger and free-form tags. Both need
  rewriting, not just ticking.
- **`DATA_MODEL.md` §1** documents the Listings columns but says the app reads
  `v_main_listing` — it doesn't record that the view carries 55 columns while the app uses
  17. Worth adding; it's the single most actionable fact in this round.
- **`lib/listings.ts`** (the fake managing-agent hash) is deletable the moment `created_by`
  is backfilled. Track it with item 2.
- **Comps panel ↔ Last Match scoping** (Q3.1) is the one place where two of these items
  genuinely conflict. Resolve it before either is built.

---

## Follow-up work — status

✅ **Done 2026-07-29 (same session):**
- **Listing edit form** — `components/ListingEditSheet.tsx`, sectioned over the full column
  set (สถานะ · ทำเล · ข้อมูลทรัพย์ · ราคา · เจ้าของ · การตลาด). The แก้ไข button is live,
  gated `listings.edit`; the marketing block's inputs are gated `listings.marketing`.
  **Save is a stub** — it diffs the draft against the row and logs the patch, because the app
  reads the read-only view. Wire = an UPDATE on the base table.
- **Lead tag on lead detail** — `components/LeadTagRow.tsx`. Assignments moved out of
  `LeadsBrowser` local state into the shared per-lead store (`NewLeadsProvider.tagOf/setTag`)
  so the table and the detail page can't disagree.
- **`HANDOVER_CHECKLIST.md`** — rewrote the tag entry (was still describing free-form
  multi-select), replaced the FAB-logger section with the Activity-log section, added the
  Last Match RLS requirement, added the 55-column listings note + the ส่วนกลาง/อายุ import
  decisions, added Quick Add, and fixed the dead `LogActivity` link.
- **`DATA_MODEL.md`** — role matrix now shows the Last Match view scope and Marketing's lost
  `activity.log` (with footnotes explaining both); listings section records 55-vs-17 columns,
  the probed types, the 15 missing columns and the import decisions; the lead-tag section
  documents the replaced model.

🔴 **Still open — needs DB work (not doable from the app):**
1. **Item 2 §2.3** — extend `v_main_listing` with the 15 missing sheet columns, applying the
   Q2.2 decisions (ส่วนกลาง → rate + unit, อายุ → `built_year`).
2. **Entity timelines on the live log** (item 4 gap 1) — listing/lead detail are server
   components on the static sample; needs the real `activities` table.
3. **Nothing persists** — every store here is in-memory by design.
4. **`created_by` backfill** — the column exists in the view but is NULL in every row, so
   the fake managing-agent seed in `lib/listings.ts` can't be deleted yet.

⚪ **Optional / deferred:** Q4.4 (CEO default chip set), Q4.5 (reach the plan from any page),
Q1.4, Q2.3, Q3.3.

---

## Questions to take back to the CEO

**All resolved as of 2026-07-29 — nothing is blocked.**

| Q | Answer | Source |
|---|---|---|
| Q1.1 | One tag per lead (single-select) | CEO |
| Q1.2 | Seed 3–4; CEO sets the real list in Settings later | CEO |
| Q3.1 | ทรัพย์เทียบเคียง panel removed — it was never requested | Ben |
| Q3.2 | Sales Leader sees the whole team | CEO |
| Q4.1 | Only the เพิ่มลีด FAB survives | CEO |
| Q2.2 | `ส่วนกลาง` → rate + unit; `อายุ` → `built_year` | Ben (delegated) |
| Q4.3 | Not a question — resolved by reading the permission matrix | code |

Still-open items are **design preferences, not blockers**: Q1.3 (tag colours), Q1.4 (can a
sale request a tag), Q2.1 (view-extension timing), Q2.3 (which fields get table columns),
Q3.3 (leaderboard match counts stay public?), Q4.2 (Quick Add chip = planned or done),
Q4.4 (CEO-pushed default chip set), Q4.5 (reaching the plan from every page).
