# HAUS CRM — Pre-Handover QA Checklist

> **Purpose.** The app is being built **design-first** — UI and flows first, real
> logic + database wired later. Before we hand the app over, every function and
> feature below must be **re-tested against real data** (not the current
> mock/placeholder state) and confirmed working.
>
> **How to use this file:**
> 1. Keep it **living** — whenever a feature is added, add a line here.
> 2. When the DB/logic is wired, walk this list **top to bottom** and tick each
>    item only after verifying it works with real data on **desktop AND mobile**.
> 3. Clear every ⚠️ *Data-wiring must-fix* before ticking the related feature.
> 4. Don't hand over with unchecked boxes.

Last updated: 2026-07-15 · Status: **design phase (DB not wired)**

---

## ⚠️ Data-wiring must-fixes (do these first)

- [ ] **`asking_price` vs `rental_price`** — the **source separates them cleanly**
      (Listings `AP` Asking, `AQ` Rental — see [DATA_MODEL.md](./DATA_MODEL.md)). Where
      HAUS shows a rent value under "ขาย", the bug is in the **DB view mapping**, not the
      source — fix the view to read AP→asking, AQ→rental.
- [ ] **Contacts have no real table** — `/contacts` runs on hardcoded sample data
      (`lib/contacts.ts`). Build a unified Supabase contacts table (owner/buyer/
      tenant/landlord roles + owned listings + demand) and swap `listContacts()` /
      `getContact()` to query it. Re-point owned-listing links to real IDs.
- [ ] **`listing_type` is a real authored field, NOT vestigial** — the source authors
      Listings `S` explicitly: `Sale` / `Rent` / `Sale & Rent` / `Sale with Tenant` /
      `Co - Agent`. Preserve it as the source of deal type (don't derive purely from price).
- [ ] Confirm every detail route's ID matches its source key (listing_id, lead_id,
      contact id, and lead `listing_code` → real listing IDs) so cross-links resolve.

---

## Feature checklist

### Shell / navigation
- [ ] Sidebar nav — all links route correctly, active state highlights right item
- [ ] Mobile drawer — hamburger opens; backdrop, Escape, and route-change all close it; body scroll locks while open
- [ ] Topbar per page — title/subtitle correct; `+ เพิ่มรายการ` / `ส่งออก` actions wired (currently placeholders)
- [ ] Skeleton loading shows on every data route during fetch, then swaps to content
- [ ] Invalid detail IDs render the not-found page (listings, leads, contacts)
- [ ] Responsive: every screen usable at phone width (locked project rule)

### Dashboard / แดชบอร์ด (`/`)  ⚠️ *analytics port of HAUS V2 — ALL sample data (`lib/dashboard.ts`)*
- [ ] **Everything here is sample.** Wire the `summary_*` sources (see [DATA_MODEL.md](./DATA_MODEL.md#dashboard-analytics--ported-from-haus-v2-built-design-first-2026-07-18)): monthly flow → `v_summary_overview_monthly`; snapshots → live `main_6_buyer_crm`/`v_main_listing` or `v_sale_status`; KPI → `v_summary_kpi`; actions/heatmap → `Actions` rollups; team goal → CEO targets tab.
- [ ] **Join key:** dashboard keys agents by **nickname**; real rows key by `sale_id`/`code` → join `sale_id → employees.code → employees.nickname`.
- [ ] **FLOW vs SNAPSHOT** split preserved: flow metrics sum over the picker months; snapshot metrics stay "as of now" (ignore the picker). Don't let a wiring shortcut turn a snapshot into a picker-summed value.
- [ ] **Pace projection** (`คาดสิ้นเดือน`) + KPI **weekly-focus** highlight read the stubbed clock (`DASH_MONTH`/`DASH_DAY`) — swap for a real clock; recompute `currentWeek()` from it.
- [ ] Reconciliation holds on real data: revenue trend Σ = leaderboard Σ = hero total for the same range.
- [ ] Charts are hand-built SVG (`ui/AreaChart.tsx`, no dependency) — responsive + theme-aware; verify at phone width (no horizontal body scroll) and in dark mode.
- [ ] Per-agent tabs are the six selling agents; gate visibility if a non-CEO viewer should only see their own tab (RBAC `performance.view_team` vs `view_own`).
- [ ] Sub-tab + range state is in-component only (not URL-synced yet) — decide if deep-linkable dashboard views are needed.

### Listings (`/listings`)
- [ ] Search (project / zone / code) filters correctly
- [ ] Status filter-chips with correct counts
- [ ] **Column sorting** works by meaning (Potential tier, status order) + numeric/text; nulls last
- [ ] Cover thumbnail — shows real photo when wired, icon fallback otherwise
- [ ] Row click → correct detail page
- [ ] Detail: identity header, specs (bed/bath/area/parking), **dual sale/rent price** (correct dimming), owner (name/phone/tel:/LINE), status + potential
- [ ] **The app now reads all 55 columns of `v_main_listing`** (was 17 — see `LISTING_COLUMNS`
      in [lib/queries.ts](./lib/queries.ts)). Live on detail: ข้อมูลทรัพย์ (land area, unit no.,
      floor, building, direction, view, position, condition, ใน/นอกโครงการ, road/soi, remark),
      ประวัติราคา (old→new + % change, update/price remarks), a **real** การตลาด card (portal
      links + posted count + ป้าย/วิดีโอ/Reels/Hometour/แผนที่ chips), and sidebar listing type /
      created date / managing agent / Owner Focus.
- [ ] 🔴 **15 sheet columns are still MISSING from the view** — extend it, then surface them:
      Hook · ส่วนกลาง · อายุ · Photo Album Link · Link · Last Match Price/Remark/Type ·
      New Photo · Facebook Ad (doc) · **DD Boost · LV Boost · FB Repost · Marketing Report**.
      The boost/report group is the marketing-ops block the CEO asked for.
  - **ส่วนกลาง holds three different units** in the source (`45 บาท` = rate per ตร.ว./month ·
    `44,000` = per year · `เดือนละ 2,024` = per month). **Decision: store the RATE** —
    `common_fee_rate` + `common_fee_unit` (`per_wa_month` | `per_sqm_month`), back-convert the
    3 outliers at import, keep the original string in `common_fee_note`. Derive the displayed
    total from the matching area column.
  - **อายุ → store `built_year`, NOT age.** Age decays (today's "15 ปี" is wrong next year and
    nobody updates it); year built never changes. Back-computing from age + `date_created` is
    ±1 yr on the ~40 existing rows — accepted, one-time. **Intake should ask ปีที่สร้าง.**
- [ ] Detail placeholders still to replace: **photo gallery** (fake images), **interested
      buyers**, **edit history**. (marketing/portal is no longer a placeholder.)
- [ ] **`แก้ไข` (listing edit)** — sectioned form over the full column set; save is a **stub**
      (the app reads a read-only view). Wire to an update on the base listing table. Gate the
      marketing block's *edit* to `listings.marketing` — DD/LV Boost, FB Repost and Marketing
      Report are not a sale's job, though everyone with `listings.view` still sees them.
- [ ] **Owner contact is PRIVATE** ([ListingOwnerCard](./components/ListingOwnerCard.tsx)): shown only to `contacts.view_all` **or** the listing's managing agent; everyone else gets the managing agent's contact (Co-Agent card). Wire to real owner-contact RLS + the real creating-agent (not the `lib/listings.ts` seed).
- [ ] **Owner follow-up signal**: `owner_talk_last_date` + `activity_comment` now render on the
      owner card. The source sheet flags stale owner talk with conditional formatting — consider
      surfacing that as an overdue badge once wired.

### Company listings (`/company-listings`) — Co-Agent inventory  ⚠️ *design-first*
- [ ] **Company-wide listing view** ([CompanyListings](./components/CompanyListings.tsx), under คลังข้อมูล, gated `listings.view`): all listings + managing-agent avatar/contact + per-agent count strip + search / status filter / agent filter / column sort. Own component — NOT `/listings` ([ListingsBrowser](./components/ListingsBrowser.tsx)).
- [ ] **Managing agent is a design-first seed** ([lib/listings.ts](./lib/listings.ts), deterministic across the 6 selling agents) because `v_main_listing` doesn't expose the creating-agent and the source is still single-agent (all Stone). Wire: read the real `AZ Created By` / per-agent-sheet owner and **delete the seed**.
- [ ] **No owner PII on this surface** — the page renders no owner contact, but `getListings()` still fetches `owner_name`/`owner_phone` to the client. At wiring, back `/company-listings` with a **view that excludes owner PII** (RLS), so it never reaches the browser here.
- [ ] `ติดต่อเซล` uses `Employee.phone`/`lineUserId`; agent avatar uses `Employee.avatarUrl` (unpopulated → initials fallback) — wire the storage bucket for real photos.
- [ ] `แก้ไข` (edit) button wired

### Leads (`/leads`)
- [ ] Search (name / phone / id) filters correctly
- [ ] Stage filter-chips with correct counts
- [ ] **Column sorting** works (grade A→C, pipeline stage order, budget/commission/date)
- [ ] Row click → correct detail page
- [ ] Detail: identity header (name/phone/tel:), info sidebar (stage/status/potential/budget/type/agent/dates all correct)
- [ ] Detail: interested listing links to the real listing; **closing card** shows only for won deals with correct commission/date
- [ ] Detail placeholders replaced/removed once wired: **activity timeline** (+ logging), **edit history**
- [ ] **Lead edit** (`LeadEditSheet`, gated `leads.edit`) — the header `แก้ไข` opens an edit sheet (name/phone/LINE/type/stage/status/potential/budget). Save is a **stub** (`console.log`); wire to a Supabase update on `main_6_buyer_crm` + optimistic reflect (detail is server-rendered, so edits currently don't persist on reload). Removed the old `นัดชม`/`ติดต่อ` buttons; header now shows **phone (tel:) + LINE** (line.me link) — `line_id` added to `getLead`.
- [ ] **Column order** — drag-and-drop reorder via the `คอลัมน์` modal, persisted to **localStorage** (`haus.leads.colOrder`). Fine as-is; optionally move to a per-user DB preference at wiring so it follows the login across devices.
- [ ] **Lead group tag** (`lib/tags.ts`) — ⚠️ **model changed 2026-07-29 (CEO feedback R1).**
      No longer free-form or multi-select. Now a **CEO-governed vocabulary, ONE tag per lead**
      ("ให้มี Standard ที่ใช้กันทุกคนไปเลย" + "ติดได้คนเดียว"). Currently in-memory
      (`MasterDataProvider.leadTags`) — not persisted.
  - Wire to **`lead_tags_ref(id, label, tone, sort_order, is_active)`** + a **single FK column
    `main_6_buyer_crm.tag_id`**. ❗ **No join table** — single-select.
  - **Colour is STORED** (`tone`), chosen by the CEO in ตั้งค่า → แท็ก Lead. It is *not* derived
    from the label any more — a company standard must look identical for everyone.
  - Sales **cannot create tags** — the picker offers only the governed list (+ "เอาแท็กออก").
    Managing the list is gated `masterdata.govern` (CEO; delegable via the roles editor).
  - **group-by-tag buckets are disjoint** now (one tag per lead), so group counts sum to the
    row total. Order follows the CEO's list order, not row count.
  - A tag deleted in Settings resolves to `null` in the table (`findTag`) — don't resurrect
    phantom chips from stale ids; prefer `is_active = false` over hard delete at wiring.
  - Seed list (นักลงทุน / ซื้ออยู่เอง / ปล่อยเช่า / ต่างชาติ) is a **placeholder** — the CEO
    sets the real one. Keep it a *buyer-type* axis: `potential` (A/B/C) already grades temperature.
  - [ ] **Show the tag on lead detail** (`/leads/[id]`) — currently table-only.

### Contacts (`/contacts`)  ⚠️ *currently sample data*
- [ ] Backed by a real contacts table (see must-fix above)
- [ ] Search (name / phone / LINE) filters correctly
- [ ] Role filter-chips (เจ้าของ/ผู้ซื้อ/ผู้เช่า/ปล่อยเช่า) with correct counts
- [ ] Desktop table + mobile cards both render; row click → correct detail
- [ ] Detail: contact info (phone tel:, LINE, email, note), demand list, owned-listings list links to real listings
- [ ] **Contact privacy**: `createdBy`/`assignedTo` enforced (own/assigned unless `contacts.view_all`) — wire to RLS + real created_by/assigned_to
- [ ] `แก้ไข`, `LINE`, `เพิ่มผู้ติดต่อ` actions wired

### Projects (`/projects`)  ⚠️ *sample data (`lib/projects.ts`)*
- [ ] Backed by a real projects table; swap `listProjects`/`getProject`/`getProjectByName`
- [ ] Search + zone filter chips with correct counts
- [ ] Card grid + completeness % render; row click → detail
- [ ] Detail: specs, unit types, pros/cons, persona, fees & juristic, flood
- [ ] Project panel on **listing detail** resolves by project name (fix name→ID join)
- [ ] `แก้ไข` / “ทรัพย์ในโครงการ” filtered link wired

### Last Match (`/last-match`)  ⚠️ *sample data (`lib/lastMatch.ts` → `main_7_last_match`)*
- [ ] Wire to `main_7_last_match`; swap `listMatches`
- [ ] Search + close-type filter chips; **column sorting** (date/project/zone/price/close/agent)
- [ ] Size (sq_wa/sq_m) + price format across mixed source formats
- [ ] 🔴 **ENFORCE THE SCOPE IN RLS** (CEO feedback R1, 2026-07-29). A sale may see only their
      own closes; a Sales Leader their team; CEO / Listing Support all. Built client-side in
      `LastMatchBrowser` via `matchScope()` + `scopeMatches()` — **convenience only, every row
      still reaches the browser.** Real enforcement = a policy on `main_7_last_match` keyed on
      the session user's employee code (`sale_id` stores `S-00x`). Marketing/Admin/HR hold no
      scope at all, so the page is hidden from their nav.
- [ ] Own-scoped viewers correctly lose the **เซลส์** column + its sort
- [ ] ~~Comps panel on listing detail~~ — **REMOVED 2026-07-29.** The ทรัพย์เทียบเคียง panel was
      never a requirement (introduced alongside the Last Match sample data) and conflicted with
      the scoping above. `getComparables()` deleted. If pricing support is wanted later, design
      it with the CEO — the privacy-safe shape is company-wide prices with the closer's name
      stripped.

### วันลา / Leave (`/leave` + ขอลา in แผนวันนี้)  ⚠️ *in-memory (`LeaveProvider`, seeded from the real HR Sheet rows)*
- [ ] Wire `leave_requests(id, employee_id, submitted_at, start_date, end_date, type, remark,
      status, decided_by, decided_at)`; swap `listLeave()`
- [ ] 🔴 **Enforce the approval gate in RLS** — only `leave.manage` may write `status` /
      `decided_by`. Client-side buttons are convenience only.
- [ ] Scope rows: `leave.manage` sees everyone, everyone else **only their own**. Currently a
      client filter in `LeaveBoard`.
- [ ] ⚠️ **The source sheet has NO approval column** — the CRM adds one. Historical rows are
      seeded `approved` with empty `decided_by`; decide whether to backfill or leave blank.
- [ ] Import must-fixes: **reversed date range** (Golf, sheet row 15 — end before start;
      seeded as 9–20 Oct, confirm with HR), **exact duplicate rows 21/22**, **free-text leave
      types** incl. a trailing-space `"ลาป่วย "`. Add a `start_date <= end_date` constraint and
      dedupe on (employee, start, end, type).
- [ ] Name → employee id: the sheet stores only a nickname; map to ids at import.
- [x] ~~Confirm whether Sales Leaders approve their team~~ — **DECIDED (Ben, 2026-08-01):
      NO.** Approval stays **CEO + HR only** (`leave.manage`), matching how it works today.
      Sales Leaders file leave like everyone else. Don't widen this without asking.
- [ ] 🔴 **Leave quota ships with PLACEHOLDER numbers — get the real ones from HR.**
      Built (`ตั้งค่า → โควตาวันลา`, gated `leave.manage`) with per-type annual allowances,
      a used/quota bar on `/leave`, and an over-quota warning list for HR.
      The source sheet has **no allowance column**, so the seeded values are Thai statutory
      MINIMUMS (`ลาพักร้อน 6 · ลากิจ 3 · ลาป่วย 30`), not company policy — the Settings screen
      says so in a banner. Blank = untracked (ลาคลอด, ลาเพื่อทำหมัน are not from an annual pool).
  - **Evidence the placeholders are wrong:** against a 6-day annual quota, **5 of 8 staff are
    already over** in 2026 (Golf 17, Pup 10). The company clearly grants more than the
    statutory minimum. Do not ship these numbers to users.
  - **Ask HR:** days per type · does unused **carry over** · what does a **first-year**
    employee get (full or pro-rated)?
  - Modelled **per leave type**, deliberately — ลาพักร้อน / ลาป่วย / ลากิจ have different
    statutory limits, so a single pooled "days remaining" would be wrong for all of them.
  - **Company-wide only** — no per-employee override. Real policies usually scale with
    seniority. Wire = `leave_allowances(type, days_per_year)` + an optional per-employee
    override table.
  - **Pending leave deliberately does NOT consume quota** (only approved does), so a request
    awaiting a decision can't silently eat someone's balance. Keep that rule at wiring.
  - No accrual, no carry-over, no pro-rating — add only if HR says they use them.
  - ⚠️ Verify the statutory figures against **current** Thai labour law at wiring; they were
    written from memory and employment law changes.
- [ ] Leave does not interact with KPI targets or the probation ladder (a day off doesn't
      reduce anyone's target). Confirm that's intended.

### Activity log  ⚠️ *in-memory (`ActivityProvider`, seeded from `lib/actions.ts`)*
> **The +บันทึก FAB was DELETED (CEO feedback R1, 2026-07-29).** Activity is now recorded by
> **completing a task in แผนวันนี้** — that is the only write path. `components/LogActivity.tsx`
> no longer exists.

- [ ] **Unified activity table** wired; `ActivityProvider.logActivity` becomes a real insert
- [ ] Action taxonomy canonicalized (23 source values → groups; Show/Showing, Reels dupes collapsed)
- [ ] A task carrying an `activityType` writes on tick; **un-ticking deletes the row**. The
      activity id derives from the task id (`taskActivityId`) so re-ticking is idempotent —
      preserve that on the server or completions will double-count.
- [ ] The activity is dated to the **task's** date, not today (back-dated plan items log correctly)
- [ ] **Count N + remark** captured by `TaskCompleteSheet` — this is what replaced the FAB's
      tally path. Entity-attached tasks are one event (no count); unattached ones tally.
- [ ] 🔴 **Same rows must appear in listing/lead detail timelines.** They currently do NOT:
      those pages are **server** components reading the static sample via
      `getActivitiesForListing` / `getActivitiesForLead`, while the live log is client-side.
      Wiring the real table fixes both ends — until then a just-logged activity shows in
      แผนวันนี้ / targets / เซลล์ใหม่ but not on the entity timeline.
- [ ] All four consumers read the same table: KPI targets (`targetCurrent`), the new-sales
      ladder (`tallyAction` / `evaluateLadder`), entity timelines, the leaderboard

### แผนวันนี้ / Targets — Momentum (`/today`, `/performance`)  ⚠️ *sample data (`lib/momentum.ts`)*
- [ ] Wire `tasks` + `targets` tables (per agent, per month); key to the session user (not fixed "Stone")
- [ ] Daily plan: date nav, completion ring, add/toggle/reorder persist; task type + linked target + entity
- [ ] **Quick-add smart time parse**: typing a leading time in the quick-add field (e.g. `10.00 นั่งสมาธิ` or `10:00 นั่งสมาธิ`) auto-sets the task's `startTime` and strips it from the title. Quick-add only (the advanced sheet already has a time field). Support `HH.MM`/`HH:MM`, optional; leave title as-is if no time prefix.
- [ ] **Quick Add chips** ([lib/quickAdd.ts](./lib/quickAdd.ts)) — per-user presets above the
      add-task field; one tap appends an **unticked** task (it's a plan; the tick is what logs).
      Persisted to **localStorage per agent** → wire to
      `user_quick_actions(user_id, label, task_type, activity_type, sort_order)`. Presets reuse
      `ACTION_GROUPS` + `TASK_TYPES` — no new vocabulary. A chip with an action logs on
      completion; one without is a plain to-do.
- [ ] **Auto-bridge**: activity-source targets compute from the real activities table; manual/pipeline +1 persists. Ticking a plan task is now the ONLY activity write path — see the Activity log section.
- [ ] Targets: official (manager-set) vs stretch (agent) write paths; ties to KPI-target templates
- [ ] **Official = the 4 sales-process KPIs** (Owner Talk, Sourcing, Survey, Buyer Follow) — `source="kpi"`, aggregated from the **`summary_kpi`** tab, **not** the activity log. Owner Talk + Buyer Follow are **`kind="ratio"`** (numerator `manualCurrent` ÷ **`denominator`**, goal 100%): read both from `*_done` / `*_total` columns. Sourcing/Survey are counts (`*_done` / `*_target`). `activityType` on a KPI target is informational, not the value source.
- [ ] **Weekly-focus rhythm**: each KPI's `focusWeekStart..focusWeekEnd` (+ `focusLabel`) highlights the KPI to push that week (Owner Talk=wk1, Sourcing/Survey=wk2–3, Buyer Follow=wk4). `currentWeekOfMonth()` is derived from the **stubbed `TODAY`** — swap to a real clock at wiring.
- [ ] **+เพิ่ม (personal goal)** — `GoalDetailSheet` appends a `stretch` target. **count** goals: auto (`activity`) if linked to an action, else `manual` (+1). **฿ (revenue)** goals: no activity link / no +1 — `source="pipeline"`, auto-derived from the agent's **actual revenue** in the system (wire to the same pipeline/commission aggregation that feeds `/performance`). Only `manual` targets get a +1 button. Currently local state only; wire to a `targets` insert scoped to the session user.

### Team / บุคคล (`/team`)  ⚠️ *sample data (`lib/team.ts`) — schema from HR Sheet*
- [ ] Wire `employees` table to the **HR Sheet → Employee Lists** schema (A–AE; see [DATA_MODEL.md](./DATA_MODEL.md#hr-sheet--people--zones--leave-2026-07-14)). Login `Employee.id` ↔ rbac `OrgUser.id`; roles via `user_roles`; effort from activities.
- [ ] **Employee record page** (`EmployeeRecord` on `/team/[id]` + `/team/new`) — detail view with **in-place edit mode** (Save/Cancel); currently stubbed (`console.log`, no persist). Validate required nickname; map form → columns. This detail-page + edit-mode flow is the **app-wide CRUD template** — apply it when wiring the dead edit buttons on listing/lead/contact/project.
- [ ] **Commission is a RATE** (`commissionRate` fraction, e.g. 0.6), not a ฿ amount — don't reintroduce a monthly-฿ field here (that's a performance/pipeline number).
- [ ] **Profile image** (`Employee.avatarUrl`) — HAUS-authored field, **no HR Sheet column**. The record page picks + previews via an in-browser object URL only (not persisted). Wire: upload the picked `File` to a storage bucket (e.g. Supabase Storage), store the returned URL in `avatarUrl`; handle replace + remove. The shared `Avatar` already renders `src` (image) with an initials fallback app-wide.
- [ ] **Two sensitivity gates enforced in RLS** to mirror the UI: money (salary + commission) on `financials.view_comp`; PII/legal docs (ID card, KBANK, payslip, agreement) on **`people.view_sensitive`**. `EmployeeRecord` hides whole sections without the gate — the server must too.
- [ ] **Zone↔sales = one join table** — HR Sheet `Zone (Sales)` (per-employee) and `Zone` tab `Current Sales Assigned` (per-zone) are inverse views; don't store both. Reconcile `lib/zones.ts` (thin) with the richer HR `Zone` tab (sheet link, location, dates).
- [ ] Lead assignment offers **sales only** (`listSalesAgents()` = active + department `sales`) — verify support/marketing/management never appear.
- [ ] Terminated staff (Nut, Pai) have **no login** (no rbac user) — confirm they can't authenticate but remain in records.

### การแจ้งเตือน / Notifications (Topbar bell)  ⚠️ *sample data + in-memory read state*
- [ ] Wire a `notifications` table to the `AppNotification` model (`lib/notifications.ts`; see [DATA_MODEL.md](./DATA_MODEL.md#notifications--topbar-bell-built-design-first-2026-07-15)). **RLS `user_id = auth.uid()` is the entire security model** — the bell has no permission gate, so scoping is the gate. `deal_won` bodies carry deal values; a mis-scoped row leaks money the compensation gate would otherwise hide.
- [ ] ⚠️ **`userId` is the login id (`u_pup`), NOT `Employee.code`** — source rows key agents by `sale_id` (`S-001`), so producers must join `sale_id → employees.code → employees.id`. Get this wrong and notifications silently go nowhere.
- [ ] **Nothing produces notifications yet** — build the producers for all 7 types: `lead_assigned` (on `/assign` writing `sale_id`), `lead_stage_changed` + `deal_won` (pipeline stage write), `task_due` (scheduled job over `tasks`), `target_milestone` (on target progress), `listing_new_in_zone` + `listing_price_changed` (listing insert/price update, joined to the zone↔sales table).
- [ ] `markRead` / `markAllRead` persist `read_at` (currently in-memory — survives navigation, resets on reload). Unread badge + per-row dot derive from it.
- [ ] Replace the stubbed `NOW` clock with real time. Re-check `dayBucket` (groups by the **+07:00** calendar date) and `relativeTimeTh` against a real clock — especially between 00:00–07:00 Thai, where a UTC-based day would mis-group.
- [ ] Deep links resolve (`/leads/[id]`, `/listings/[id]`, `/today`, `/performance`) — seeded ids are real today; confirm after any id migration.
- [ ] Consider realtime (Supabase subscription) so the badge updates without a reload; currently the feed only refreshes on mount.
- [ ] **LINE push is NOT built** — deliberate. `Employee.lineUserId` exists and Thai teams run on LINE, but there are **no `channel` / `delivered_at` columns**. If the client wants it, that's a migration + a LINE Messaging API worker, not a config toggle.
- [ ] Copy is **stored rendered text** — re-wording notification copy later needs a backfill; old rows keep their original wording and frozen values.

### Lead Database + intake (`/assign`, FAB, timeline)  ⚠️ *design-first, not persisted (`lib/leads.ts`)*
- [ ] **Lead Database** (renamed from มอบหมาย Lead): the master list of ALL leads (received + assigned) for admin/CEO reference + reporting — summary stats + **CSV export** (client-side, of the filtered rows) + inline assign/reassign. Gated to `leads.view_all`/`leads.assign`.
- [ ] **⚠️ Scale — move filter/sort/paginate SERVER-SIDE at wiring** (`LeadAssignment.tsx`, `getCrm`): the table has Google-Sheets-style per-column value filters (ประเภท/ช่องทาง/สเตจ/สถานะ/มอบหมายให้), sortable headers, and pagination (page-size 25/50/100) — but all run **client-side over the full row set**, and `getCrm()` fetches **every** row. Fine for the design build's ~10 sample leads; **not** for real volume (≈600 leads/mo → 10k+/yr). Wire to the query: Supabase `.ilike()`/`.eq()`/`.in()` for search+filters, `.order()` for sort, `.range(from,to)` for the page, `count:"exact"` for the total. The **UI/controls stay identical** — only the data source changes. Two things to resolve then: (a) the optimistic new-lead merge (`NewLeadsProvider`) must move into the query or be unioned server-side; (b) CSV export currently dumps the **filtered client rows** — at scale make it a server export of the full filtered set, not just the loaded page.
- [ ] **Budget is in baht** in `main_6_buyer_crm` (the app renders `formatBaht(budget)` directly on `/leads` and here) — do NOT re-scale by 1e6, despite the source sheet's "Budget (millions)" label. Confirm the view's units at wiring.
- [ ] **Intake FAB** (`+ เพิ่มลีด`, gated to `leads.create`) → wire submit to a **Supabase insert** into `main_6_buyer_crm`; add the new **`source`/ช่องทาง** column + a **`requirements`** block (buyer: zone/type/bedrooms/purpose · owner: type/reason). `lead_type` from who files (rep→Lead, admin→Company).
- [ ] **AI paste-to-parse** is a **heuristic stub** (`lib/ai/parseLead.ts`) with the real Shelter contract (`{ok,note,draft}`, nullable, enum-locked, "return null never guess"). Swap for the OpenAI `gpt-4.1` server action + `OPENAI_API_KEY` + phone→contact dedupe; carry over the `classify`/`messageFor` error UX. UI (`AiPasteBox`) doesn't change.
- [ ] **Assignment**: default = the interested listing's **owner-sale** (`defaultAssignee`, listing→zone→employees) — wire the real join; overrides + reassign live in `NewLeadsProvider` (→ Supabase update + `audit_log` row). Resolve the **sale_id(code)↔nickname** mismatch (assign UI uses nicknames; real `sale_id` is `S-xxx`).
- [ ] **Lead timeline** (`/leads/[id]`) is seeded sample (`lib/leadTimeline.ts`) + live reassign audit — wire to real activities (`related_lead_id`) + `audit_log` so admin sees what sales logged before reassigning.
- [ ] Optimistic new leads (`ใหม่` badge) come from `NewLeadsProvider` (in-memory) — they vanish on reload until the insert is wired, and their detail page 404s (not in Supabase yet).
- [ ] **Intake form fields** now mirror the real *Lead Submission* sheet: Marketing Channel, Contact By, LINE ID, Gender, Nationality, contact date/time, searchable listing (code/name). Add the matching columns to `main_6_buyer_crm` at wiring (`source`, `contact_by`, `line_id`, `gender`, `nationality`, `contact_date`/`contact_time`).
- [ ] **Admin follow-up** (`LeadAdminPanel`, gated `leads.assign`): the "sale contacted?" recheck is **DERIVED from `pipeline_stage`** (`isContacted` = any stage past "Lead"), not a manual field — so when the stage-change action is wired (sale moves Lead→Call), it auto-flips. Complaint (status + remark) is manual, in-memory (`NewLeadsProvider.process`) → wire to a lead update / `audit_log`. (Note: the sheet's Recheck column becomes redundant once stage drives it.)
- [ ] Assign writes `sale_id` on the lead; unassigned filter correct; gate on `leads.assign`

### Settings hub (`/settings`, Shelter-style single page)  ⚠️ *sample data + in-memory*
- [ ] **Roles & Permissions** (`lib/rbac.ts`): persist roles/permissions/user-roles; replace the in-memory `RbacProvider` + view-as with the auth session; enforce `can()` at the **page/server** level too (nav + FAB gating already client-side)
- [ ] **Seed the role matrix as the real policy** — `SEED_ROLES` now ships a client-agreed permission set per role (see [DATA_MODEL.md → Seeded role matrix](./DATA_MODEL.md#seeded-role-matrix--this-is-the-access-policy-2026-07-15)). **That table is the spec RLS must reproduce**; the client-side `can()` is convenience, not enforcement. Verify each persona against it after wiring.
- [ ] **`financials.view_comp` gates COMPENSATION ONLY** (renamed from `financials.view` — the old "ราคา/คอมมิชชั่น" label invited over-granting). It must **not** be wired to gate listing prices; asking/rental price is visible to anyone with `listings.view`.
- [ ] Unstaffed roles (Admin, HR) are seeded but hold **0 users** — confirm 0 users really means 0 access once RLS is live, and delete any role the org never staffs. (**Sales Leader is now staffed** — Pup & Game, the seeded team leads.)
- [ ] **Sales teams** ([lib/teams.ts](./lib/teams.ts), Settings ▸ ทีม gated `teams.manage` — [TeamsManager](./components/TeamsManager.tsx)): create team + leader + monthly `revenueGoal` + members (one team per person). Currently **in-memory in the org store** (`RbacProvider`) + a 2-team seed. Wire: a `teams` table + membership (`employees.team_id` or a `team_members` join). Verified: CEO manages teams; a leader (Pup) sees only their team on `/team`; the roster shows a team column + scope banner.
- [ ] **Team scoping is applied to the `/team` roster only so far.** The helper `visibleMemberIds(teams, viewerId, isOrgWide)` ([lib/teams.ts](./lib/teams.ts)) is the reusable rule (org-wide → all; team leader → own team; else self). ⚠️ **Still to scope with the same helper:** the **dashboard leaderboard**, **/performance**, and the **Lead Database** (team-filter leads by the assigned sale's team), plus surfacing team **`revenueGoal`** as a team-level target on the dashboard. `isOrgWide` is currently `roles.manage || people.manage` (CEO/HR) — confirm that's the intended "sees all teams" set at wiring.
- [ ] ⚠️ **Most of the matrix is declarative, not enforced.** Only a handful of gates actually change the UI today — `contacts.view_all` ([ContactsBrowser](./components/ContactsBrowser.tsx)), the three `lastmatch.view_*` scopes ([LastMatchBrowser](./components/LastMatchBrowser.tsx)), `financials.view_comp` + `people.manage` ([TeamTable](./components/TeamTable.tsx)), `financials.view_comp` + `people.view_sensitive` + `people.manage` ([EmployeeRecord](./components/EmployeeRecord.tsx)), and the per-section gating inside `/settings` ([SettingsView](./components/SettingsView.tsx)). Every other permission only filters the **sidebar nav** ([lib/nav.ts](./lib/nav.ts)) — the page itself renders fully if reached by URL. Specifically: `leads.view_own` does **not** scope `/leads`, `performance.view_team` does **not** gate the dashboard leaderboard, and `listings.edit` / `projects.edit` / `targets.set` gate nothing. **Wiring must enforce every gate at the server/RLS level** — the matrix is the intent, the app does not yet honour it. (`activity.log` no longer gates a FAB — the logger was removed; it now marks who records activity by completing plan tasks.)
- [ ] **Master data is split into two gates** ([lib/rbac.ts](./lib/rbac.ts)): `masterdata.govern` = structural/leadership data (zones, action types, KPI templates — CEO-only) · `reference.manage` = the light lead/listing vocabularies (property type, marketing channel, contact-by, gender, nationality — **granted to Listing Support** + CEO). `/settings` shows only the sections the viewer can govern (verified: CEO 6 sections, Listing Support 2, Agent none). Enforce both gates server-side.
- [ ] **Zones** (`lib/zones.ts` → `zone`): wire table; `+ เพิ่มโซน` / row edit write (`masterdata.govern`)
- [ ] **Delete guards with impact warnings**: every settings delete (enum values, KPI templates, teams, roles) opens the [ConfirmDelete](./components/ui/ConfirmDelete.tsx) popover naming the value + its **usage impact** — property types count **live listings** (computed in [app/settings/page.tsx](./app/settings/page.tsx)), action types count the activity log, teams state member count, roles state user count; Marketing Channel / Contact By / เพศ / สัญชาติ show "ยังไม่นับการใช้งาน" until their columns exist (**wire the real counts then**). ⚠️ UI guard only — at wiring, **block deleting an in-use value server-side** (FK/reference check → archive/disable instead of hard delete).
- [ ] **Reference vocabularies are now LIVE via [MasterDataProvider](./components/MasterDataProvider.tsx)** — property type, Marketing Channel, Contact By, gender, nationality are one shared in-memory store: Settings edits ([MasterDataManagers](./components/MasterDataManagers.tsx)) **immediately propagate to the intake form** ([LeadForm](./components/LeadForm.tsx)) — delete a channel and the dropdown loses it, rename and it updates (verified). Rules: seed items keep their ids across label renames (stored rows keep matching); custom items use `id = label`; existing rows keep displaying old values via raw-value fallback. The two divergent `PROPERTY_TYPES` lists were unified onto [lib/masterdata.ts](./lib/masterdata.ts) (lib/leads re-exports it); `LeadSource`/`ContactBy` types are now `string` (vocabulary = data, not a compile-time union). **Wire:** promote each list to an `id + label (+ is_active)` table; the provider becomes a fetch+mutation layer; keep archive-instead-of-delete. Action types + KPI templates are NOT provider-backed yet (local edit only).

### ⛔ Still not designed
- [ ] Decide back-office vs. CRM for remaining unreviewed tabs (New Lead, Spending, Comments, Dashboards)
- [ ] **เว็บพอร์ทัล (`/website`)** — Marketing's manager for the customer-facing portal website (menu/banners/content). Coming-soon placeholder only; **blocked on the portal itself being designed**. Nav + `website.manage` permission (Marketing + CEO) are already wired — design the page once the portal exists, then enforce the gate server-side like every other permission.

### Cross-cutting
- [ ] **Pages are ISR-cached (`export const revalidate = 30`, was `force-dynamic`)** — menu navigation serves the cached page instantly; Supabase data is at most ~30s stale. At wiring, when the app starts WRITING data, revalidate the affected pages on mutation (`revalidatePath`/`revalidateTag`) so users see their own edits immediately — don't rely on the 30s window.
- [ ] Money formatting (฿X ล้าน / ฿X,XXX / ฿X/ด.) correct across all views
- [ ] Thai Buddhist-era dates correct everywhere
- [ ] Numerals use the mono/tabular treatment
- [ ] Empty states show sensible copy (no rows / no results / no data)
- [ ] `ส่งออก` (export) wired or removed
- [ ] Auth / access control (if any) enforced before handover

---

## Notes
- This list reflects features as of the date above; **update it as the app grows.**
- Design decisions and rationale live in the team's design-system notes; this file
  is strictly the **"does it work with real data"** gate for handover.
