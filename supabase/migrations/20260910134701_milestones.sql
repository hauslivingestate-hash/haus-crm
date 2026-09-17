-- เป้าหมายช่วงนี้ — the goals that are neither revenue nor counted activity.
-- Ported from Klaichan CRM. "เดือนนี้จะเริ่มวางระบบ", "เดือนนี้ทำคอนเทนต์ 3 ชิ้น".
--
-- WHY NOT `targets`. That table puts a number on something the app counts: an activity
-- tally, or signed commission. Nothing in this CRM counts "วางระบบ". Forcing an intention
-- into a table whose whole premise is automatic progress means either a goal that sits at
-- 0 for ever or a fake source that nothing feeds — and this app has already been bitten
-- by the second one (every baht goal read ฿0 until 2026-09-10 because it was stored under
-- a source nothing wrote).
--
-- PROGRESS IS TYPED BY A PERSON, and there will be no auto-count. Inferring "คอนเทนต์ 3
-- ชิ้น" from three tasks would produce a number that disagrees with what the person meant
-- and that they cannot correct.
--
-- KEYED ON period + period_key, the same pair `targets` now uses, so the card obeys the
-- range bar: เดือนนี้ asks for ('month','2026-09') and ไตรมาสนี้ for ('quarter','2026-Q3').
-- A monthly intention therefore cannot leak into the quarterly view pretending to be one.
--
-- PER PERSON, unlike Klaichan's — Klaichan is one agent, HAUS is six, and a goal list
-- shared by the whole company would be nobody's.
create table public.milestones (
  id            bigserial primary key,
  employee_code text not null references public.main_1_hr(employee_code)
                  on update cascade on delete cascade,
  period        text not null check (period = any (array['day','week','month','quarter','year'])),
  period_key    text not null,
  title         text not null,
  -- null = a plain intention, done or not. A number = "1 of 3".
  target        integer check (target is null or (target > 0 and target <= 99)),
  done          integer not null default 0 check (done >= 0),
  note          text,
  sort_order    integer not null default 0,
  -- Archived, never deleted: a goal that was set and missed is a fact about the period.
  archived_at   timestamptz,
  created_at    timestamptz not null default now()
);

create index milestones_owner_period_idx
  on public.milestones (employee_code, period, period_key)
  where archived_at is null;

comment on table public.milestones is
  'เป้าหมายช่วงนี้ — intentions that nothing counts automatically. Progress is typed by the owner. See แดชบอร์ดขาย.';

alter table public.milestones enable row level security;

-- Your own, always. A leader sees their team's through the same helper every other
-- performance surface uses, so "who may see whose numbers" has one answer in this schema.
create policy p_select on public.milestones for select
  using (
    employee_code = (select current_employee_code())
    or ((select has_perm('performance.view_team'))
        and employee_code in (select visible_employee_codes()))
  );

-- YOUR OWN ONLY, for all three writes — including a leader's. An intention is the
-- person's own words; a manager writing one into somebody's list would be putting words
-- in their mouth, which is exactly the line `targets` draws between official and stretch.
create policy p_insert on public.milestones for insert
  with check (employee_code = (select current_employee_code()));

create policy p_update on public.milestones for update
  using (employee_code = (select current_employee_code()));

create policy p_delete on public.milestones for delete
  using (
    employee_code = (select current_employee_code())
    or (select has_perm('roles.manage'))
  );;
