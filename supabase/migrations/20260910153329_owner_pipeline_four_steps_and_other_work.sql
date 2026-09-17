/* Ben, 2026-09-10 (second pass on the owner side).
   The owner pipeline is:  Sourcing → New List → Owner Talk → Owner Visit

   Two things changed from this morning's version:
     · Sourcing joins as step 1. It was sitting in 'ทั่วไป' because it attaches to no
       record — there is no listing yet — which is precisely what makes it step one.
     · Exclusive Offer is removed. Ben: "that's it", four steps.

   And a THIRD BUCKET is recognised: work that belongs to neither pipeline. ประเมิน,
   ถ่ายรูป, Reels, ติดป้าย, โอน, Update Price and Survey are real, countable work that
   advances no stage on either side — marketing a unit, appraising it, handing it over.
   They are `side = 'general'` and the card gives them their own section, counted but not
   funnelled. Ben: "it's not pipeline but only action count type." */

-- ── the pipeline itself ──────────────────────────────────────────────────────────
-- ⚠️ DELETES 'Exclusive Offer'. Safe: every one of the 544 listings currently sits on
-- 'New List', so the row is referenced by nothing. The FK would refuse the delete
-- otherwise, which is the check working rather than a risk being taken.
insert into owner_stage (name, sort_order) values ('Sourcing', 0)
  on conflict (name) do update set sort_order = 0;

update owner_stage set sort_order = 2 where name = 'New List';
update owner_stage set sort_order = 3 where name = 'Owner Talk';
update owner_stage set sort_order = 4 where name = 'Owner Visit';
update owner_stage set sort_order = 1 where name = 'Sourcing';

delete from owner_stage where name = 'Exclusive Offer';

-- ── which action advances which owner step ───────────────────────────────────────
update action_type set side = 'listing' where name in ('Sourcing', 'New List', 'Owner Talk', 'Owner Visit');
update action_type a set owner_stage_name = a.name
  where a.name in ('Sourcing', 'New List', 'Owner Talk', 'Owner Visit');

-- ── everything else on the property side becomes countable work, not pipeline ────
-- owner_stage_name has to be cleared first: the check constraint forbids a listing-side
-- link on a row whose side is 'general'.
update action_type set owner_stage_name = null
  where name in ('Survey', 'ประเมิน', 'ถ่ายรูป', 'Reels', 'ติดป้าย', 'โอน', 'Update Price');
update action_type set side = 'general'
  where name in ('Survey', 'ประเมิน', 'ถ่ายรูป', 'Reels', 'ติดป้าย', 'โอน', 'Update Price');

/* ── ทรัพย์ใหม่ IS RETIRED ────────────────────────────────────────────────────────
   It counted listings straight from main_4_listing_database, deliberately separate from
   the "New List" ACTION, because the two disagree — S-004 has 89 listings and 152 logged
   New List actions for 2026. Ben, 2026-09-10: "remove the ทรัพย์ใหม่ because it's the
   same as new list."

   ⚠️ THE CONSEQUENCE, recorded so nobody rediscovers it as a bug: the owner side now
   counts the ACTION. A person who logs New List twice for one unit counts twice, and one
   who creates a listing without logging the action counts zero. The listings table still
   holds the truth; nothing on this dashboard reads it any more. */
drop function if exists public.dash_new_listings(text, date, date);
drop function if exists public.dash_new_listing_rows(text, date, date);

-- ── goals on owner steps ─────────────────────────────────────────────────────────
-- The twin of targets.stage_name. Same reasoning: a real FK with ON UPDATE CASCADE, so
-- renaming a step in ตั้งค่า carries the goal with it instead of orphaning it.
alter table targets
  add column owner_stage_name text
    references owner_stage(name) on update cascade on delete cascade;

comment on column targets.owner_stage_name is
  'Which owner pipeline step this goal scores, for source = ''owner_stage''. The dashboard sums every action whose action_type.owner_stage_name matches.';

-- 'listing' goes (ทรัพย์ใหม่ was its only user and no row was ever written);
-- 'owner_stage' arrives.
alter table targets drop constraint targets_source_check;
alter table targets add constraint targets_source_check
  check (source in ('activity', 'pipeline', 'manual', 'kpi', 'revenue', 'stage', 'owner_stage'));

alter table targets drop constraint targets_metric_matches_source;
alter table targets add constraint targets_metric_matches_source check (
  case source
    when 'stage'       then stage_name is not null and owner_stage_name is null
    when 'owner_stage' then owner_stage_name is not null and stage_name is null
    else stage_name is null and owner_stage_name is null
  end
);

drop index if exists targets_one_per_work_metric;
create unique index targets_one_per_work_metric on targets (
  employee_code, owner, period, period_key, source,
  coalesce(activity_type, ''), coalesce(stage_name, ''), coalesce(owner_stage_name, '')
) where month is null and source in ('activity', 'stage', 'owner_stage');;
