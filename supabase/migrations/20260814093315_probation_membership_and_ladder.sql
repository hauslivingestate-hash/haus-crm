-- เซลล์ใหม่ (probation), Phase 8 groundwork.
--
-- Ben, 2026-08-14: "นับจาก 0 เลย ตอนนี้ยังไม่มี แต่คนอื่นๆ ผ่านหมดแล้ว" — the program starts
-- empty, and everyone currently employed is recorded as having passed. So membership needs
-- to be a real fact, not derived from date_started (which is 2025-11-01 for all ten and
-- would otherwise put the whole sales team on the board or none of it).

alter table main_1_hr
  add column if not exists probation_start date,
  add column if not exists probation_passed_at date;

comment on column main_1_hr.probation_start is
  'เข้าโปรแกรมเซลล์ใหม่เมื่อไหร่ — null = ไม่เคยเข้าโปรแกรม. เกณฑ์แบบ total นับกิจกรรมตั้งแต่วันนี้';
comment on column main_1_hr.probation_passed_at is
  'ผ่านโปรเบชั่นเมื่อไหร่ — null ทั้งที่มี probation_start = ยังอยู่ในโปรแกรม (คือประชากรของกระดาน)';

-- Everyone on the books today has passed.
update main_1_hr
   set probation_start = coalesce(probation_start, date_started),
       probation_passed_at = coalesce(probation_passed_at, current_date)
 where probation_passed_at is null;

-- ── The ladder itself ────────────────────────────────────────────────────────
-- Was SEED_SALES_RANKS in lib/probation.ts plus an in-memory provider: the CEO could edit
-- the ranks in ตั้งค่า and lose every change on reload.

create table if not exists probation_rank (
  id          text primary key,
  name        text not null,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists rank_criterion (
  id            text primary key,
  rank_id       text not null references probation_rank(id) on delete cascade,
  -- Same vocabulary as ประเภทกิจกรรม and the KPI templates — one activity list, not three.
  activity_type text not null references action_type(name) on update cascade,
  target        int  not null check (target > 0),
  -- `window` is reserved in SQL, hence the prefix.
  count_window  text not null check (count_window in ('total','monthly')),
  sort_order    int  not null default 0
);

create index if not exists ix_rank_criterion_rank on rank_criterion(rank_id);

-- Seed = the ladder that was hard-coded, so nothing changes for the CEO on first open.
insert into probation_rank(id, name, sort_order) values
  ('r_rookie', 'Rookie', 1),
  ('r_junior', 'Junior', 2),
  ('r_pro',    'Senior', 3)
on conflict (id) do nothing;

insert into rank_criterion(id, rank_id, activity_type, target, count_window, sort_order) values
  ('c_r1_call',   'r_rookie', 'Call',        20, 'total',   1),
  ('c_r1_survey', 'r_rookie', 'Survey',       5, 'total',   2),
  ('c_r2_call',   'r_junior', 'Call',        30, 'monthly', 1),
  ('c_r2_show',   'r_junior', 'Show',         5, 'total',   2),
  ('c_r2_owner',  'r_junior', 'Owner Visit',  4, 'total',   3),
  ('c_r3_show',   'r_pro',    'Show',        10, 'total',   1),
  ('c_r3_win',    'r_pro',    'Win',          1, 'total',   2)
on conflict (id) do nothing;

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- A new table without policies is unreadable: Supabase's rls_auto_enable() turns RLS on for
-- every new table, so the ladder would come back empty for everyone.
alter table probation_rank  enable row level security;
alter table rank_criterion  enable row level security;

revoke all on probation_rank, rank_criterion from anon;
grant select, insert, update, delete on probation_rank, rank_criterion to authenticated;

-- Readable by anyone signed in (the board shows the ladder to the agent on it);
-- writable only by whoever governs master data, matching zone/action_type.
create policy p_select on probation_rank for select to authenticated using (true);
create policy p_insert on probation_rank for insert to authenticated
  with check ((select has_perm('masterdata.govern')) or (select has_perm('roles.manage')));
create policy p_update on probation_rank for update to authenticated
  using      ((select has_perm('masterdata.govern')) or (select has_perm('roles.manage')))
  with check ((select has_perm('masterdata.govern')) or (select has_perm('roles.manage')));
create policy p_delete on probation_rank for delete to authenticated
  using ((select has_perm('masterdata.govern')) or (select has_perm('roles.manage')));

create policy p_select on rank_criterion for select to authenticated using (true);
create policy p_insert on rank_criterion for insert to authenticated
  with check ((select has_perm('masterdata.govern')) or (select has_perm('roles.manage')));
create policy p_update on rank_criterion for update to authenticated
  using      ((select has_perm('masterdata.govern')) or (select has_perm('roles.manage')))
  with check ((select has_perm('masterdata.govern')) or (select has_perm('roles.manage')));
create policy p_delete on rank_criterion for delete to authenticated
  using ((select has_perm('masterdata.govern')) or (select has_perm('roles.manage')));;
