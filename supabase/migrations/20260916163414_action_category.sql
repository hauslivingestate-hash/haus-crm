-- หมวดกิจกรรม — the category axis the ทีม tab's heatmap filters on.
--
-- ── WHY A TABLE AND NOT A CHECK CONSTRAINT ──────────────────────────────────────
-- Same rule as every other reference list here (pipeline_stage, owner_stage,
-- marketing_channel): the values are the company's vocabulary, not the code's. A CHECK
-- constraint listing six Thai strings would need a migration to rename one, and the
-- heatmap's pills would have to name them in code — the exact bug lib/tables/fills.ts
-- was rewritten to remove.
--
-- Keyed on the label itself with ON UPDATE CASCADE, like its siblings, so renaming a
-- category in ตั้งค่า rewrites every action_type row pointing at it.
create table if not exists public.action_category (
  name       text    primary key,
  sort_order integer not null default 0
);

alter table public.action_category enable row level security;

-- Read by anyone signed in (the pills are on a dashboard); written only by whoever
-- governs master data. Mirrors the policies on action_type.
drop policy if exists p_select on public.action_category;
create policy p_select on public.action_category for select to authenticated using (true);

drop policy if exists p_insert on public.action_category;
create policy p_insert on public.action_category for insert to authenticated
  with check ((select has_perm('masterdata.govern')) or (select has_perm('roles.manage')));

drop policy if exists p_update on public.action_category;
create policy p_update on public.action_category for update to authenticated
  using ((select has_perm('masterdata.govern')) or (select has_perm('roles.manage')));

drop policy if exists p_delete on public.action_category;
create policy p_delete on public.action_category for delete to authenticated
  using ((select has_perm('masterdata.govern')) or (select has_perm('roles.manage')));

grant select on public.action_category to authenticated;
grant insert, update, delete on public.action_category to authenticated;

-- The five HAUS V2 overview categories, in its pill order. ("ทั้งหมด" is not one of
-- them — it is the sum, and storing it as a row would let someone file an action under
-- the total.)
insert into public.action_category (name, sort_order) values
  ('ฝั่งเจ้าของ', 1),
  ('ฝั่งผู้ซื้อ',  2),
  ('สำรวจ',       3),
  ('ธุรการ',      4),
  ('บริษัท',      5)
on conflict (name) do nothing;

-- NULLABLE on purpose: an action nobody has filed yet is a real state, and it must show
-- as "ไม่ระบุ" rather than being silently counted under whichever category the column
-- defaulted to. ON DELETE SET NULL for the same reason — deleting a category must not
-- delete the actions filed under it.
alter table public.action_type
  add column if not exists category text
  references public.action_category(name) on update cascade on delete set null;

grant select (category), update (category) on public.action_type to authenticated;

create index if not exists action_type_category_idx on public.action_type (category);;
