-- A revenue target is a target like any other — same table, same per-person per-month
-- row, same owner split (official = set by whoever holds targets.set; stretch = the sale's
-- own extra). It needs its own SOURCE because of where its progress comes from: not a
-- typed-in number and not an activity tally, but the commission on this person's signed
-- deals. `targetCurrent()` in lib/momentum.ts computes it live, the way it already does
-- for activity-source targets.
--
-- WHY NOT A SECOND TARGETS TABLE for the dashboard. The number on แดชบอร์ด and the number
-- on แผนวันนี้ have to be the same number. Two tables both called "the target" is how they
-- start disagreeing, and the disagreement is invisible until someone compares screens.
alter table public.targets drop constraint targets_source_check;

alter table public.targets add constraint targets_source_check
  check (source = any (array['activity'::text, 'pipeline'::text, 'manual'::text, 'kpi'::text, 'revenue'::text]));;
