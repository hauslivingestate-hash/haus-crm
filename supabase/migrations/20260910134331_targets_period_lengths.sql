-- เป้าหมายต่อช่วงเวลา — a target can now be set per DAY / WEEK / MONTH / QUARTER / YEAR.
--
-- WHY, AND WHAT IT REPLACES. The dashboard's first build stored one monthly figure and
-- divided it by days to fill a "7 วัน" or "ไตรมาสนี้" bar. Klaichan CRM considered exactly
-- that and rejected it, in their own words: pro-rating a single monthly figure across a
-- quarter is arithmetic pretending to be a goal — Thai property is not flat across the
-- year, and a Songkran month is not a March. Ben, 2026-09-10: match Klaichan. So the
-- leader sets a real number per period length and no division ever invents one.
--
-- period_key = '' is a STANDING target: it applies to every period of that length.
-- period_key = '2026-09' / '2026-Q3' / '2026' overrides that one specific period, so a
-- quiet January or a Songkran push can carry its own figure without disturbing the rest.
--
-- `month` stays, nullable, and still belongs to แผนวันนี้'s per-month KPI goals — those are
-- a different animal (a labelled list of things to do this month, progress off the
-- activity log). Revenue targets carry month = null and use period/period_key instead.
-- Safe to restructure freely: the table holds 0 rows today.
alter table public.targets
  add column if not exists period text not null default 'month',
  add column if not exists period_key text not null default '';

alter table public.targets drop constraint if exists targets_period_check;
alter table public.targets add constraint targets_period_check
  check (period = any (array['day'::text, 'week'::text, 'month'::text, 'quarter'::text, 'year'::text]));

alter table public.targets alter column month drop not null;

-- One standing (or one override) revenue figure per person per period length. Without
-- this, saving the editor twice leaves two rows and the dashboard silently reads double.
create unique index if not exists targets_one_per_period
  on public.targets (employee_code, source, owner, period, period_key)
  where source = 'revenue';

comment on column public.targets.period is
  'ความยาวของช่วงที่เป้านี้ตั้งไว้: day|week|month|quarter|year. แผนวันนี้ (KPI รายเดือน) ใช้ month';
comment on column public.targets.period_key is
  '"" = เป้าประจำ ใช้กับทุกช่วงความยาวนี้. หรือระบุช่วงเดียว เช่น 2026-09, 2026-Q3, 2026';;
