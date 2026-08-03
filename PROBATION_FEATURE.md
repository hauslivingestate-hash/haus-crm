# HAUS CRM — New-Sales Probation Ranks (เซลล์ใหม่)

**Status:** Design-first UI built, DB wiring deferred
**Last updated:** 2026-07-25

> **Build approach: design-first UI, no DB yet.** The rank ladder lives in memory
> (`ProbationProvider`, seeded from `lib/probation.ts`) and resets on reload. The employee
> probation tag is a seeded field (`Employee.probationStart` in `lib/team.ts`). Tallies read
> the seeded unified activity log. This doc records the wire-later target.

---

## What it does

New sales are tracked through a CEO-defined **rank ladder** during probation. Each rank's
criteria count the **same action entity** the KPI system uses (`Call`, `Show`, `Owner
Visit`… from `ACTION_GROUPS` / Settings → ประเภทกิจกรรม) — no separate metric vocabulary.

- **Settings → Rank เซลล์ใหม่** (gated `masterdata.govern`, CEO): ordered ranks, each with
  criteria rows of **action × target × window**. Window is per-criterion (Ben: "have both"):
  - `total` (สะสมรวม) — cumulative since `probationStart`
  - `monthly` (ต่อเดือน) — within the current month
  (`components/SalesRankManager.tsx`)
- **เซลล์ใหม่ page** (`/new-sales`, nav under บุคลากร, gated `performance.view_team` — CEO +
  Sales Leader): leaderboard of everyone in the program — current rank, ladder chips,
  days in program, per-criterion progress bars toward the next rank, progress ring.
  (`components/NewSalesBoard.tsx`)
- **The tag:** `Employee.probationStart` (date entered the program). Present = "เซลล์ใหม่"
  pill (TeamTable); rank itself is never stored. Seeded on Mhow + Golf.

## Key decision — AUTO-PROMOTE = derived rank (Ben, 2026-07-25)

Rank is **derived, not stored**: a rank is achieved when ALL its criteria are met, and the
current rank is the longest leading run of achieved ranks (sequential ladder). Passing the
last rank = ผ่านโปรเบชั่น. So logging activities or editing the ladder re-ranks everyone
instantly — there is no promote button and no stored rank to drift out of sync.

**Caveat (accepted for the design build):** monthly criteria are evaluated against the
*current* month, so a live-derived rank can drop when a new month starts. Wire-later fixes
this with a **promotion log** (see below) making ranks monotonic once earned.

## Engine (`lib/probation.ts`)

- `SalesRank { id, name, criteria: RankCriterion[] }`, `RankCriterion { activityType,
  target, window }` — ladder order = array order.
- `tallyAction(nickname, type, window, since)` — sums `Activity.count` from the unified log.
- `evaluateLadder(nickname, ladder, probationStart)` → per-rank/per-criterion progress,
  `currentIndex`, `next`, `passed`.
- `ladderScore()` — leaderboard sort: rank first, then progress toward next.

## Wire-later target (DB)

```sql
create table probation_rank (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  sort_order int not null,
  is_active  boolean not null default true
);

create table rank_criterion (
  id            uuid primary key default gen_random_uuid(),
  rank_id       uuid not null references probation_rank(id) on delete cascade,
  activity_type text not null,          -- action name (same vocabulary as activities/KPI)
  target        int not null,
  window        text not null default 'total'   -- total | monthly
);

-- Monotonic promotions: a rank, once earned, is kept even if a later month dips.
create table rank_achievement (
  employee_id text not null,
  rank_id     uuid not null references probation_rank(id),
  achieved_at timestamptz not null default now(),
  primary key (employee_id, rank_id)
);
-- employees table gains: probation_start date null  (null = not in program / passed)
```

A daily job (or on-log trigger) runs `evaluateLadder` per new sale and inserts
`rank_achievement` rows; passing the last rank clears `probation_start` (auto-graduate)
and can notify the CEO.

## Open items

1. **Setting the tag in-app** — `probationStart` is seed-only for now; add the field to the
   EmployeeRecord ข้อมูลงาน edit form (HR sets it when hiring a new sale).
2. Graduation side-effects — on pass: notification to CEO/leader? Commission-rate change?
3. Whether monthly criteria should require N *consecutive* months (currently: current month).
