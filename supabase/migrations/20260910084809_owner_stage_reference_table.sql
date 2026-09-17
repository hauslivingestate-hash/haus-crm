-- The OWNER-side pipeline: where the relationship with the person selling has got to.
--
-- The company tracked one pipeline and it was the buyer's (main_6_buyer_crm.pipeline_stage).
-- The owner side had actions — Owner Talk, Owner Visit, Survey, ประเมิน, New List — and
-- nowhere to record what they added up to. `listing_status` looks like a stage and is not:
-- Need Info → Ready to Post → Posted is the MARKETING queue, a fact about the advert rather
-- than about the owner. A listing can sit at Posted for months while the owner conversation
-- goes from warm to dead, and nothing in the database could say so.
--
-- Same shape as pipeline_stage / listing_status (name, color, sort_order) so it is one more
-- reference list rather than a special case, and it is managed from ตั้งค่า like the others.
create table if not exists public.owner_stage (
  name        text primary key,
  color       text,
  sort_order  integer
);

-- Names mirror the owner-side action_type rows one-for-one, so "log Owner Talk → move to
-- Owner Talk" is an obvious pairing rather than a mapping anyone has to memorise.
insert into public.owner_stage (name, color, sort_order) values
  ('Sourcing',     'blue',    1),   -- หาทรัพย์ — found it, owner not yet spoken to
  ('Owner Talk',   'teal',    2),   -- คุยเจ้าของ
  ('Owner Visit',  'violet',  3),   -- นัดดูทรัพย์ (Owner Visit · Survey)
  ('Appraise',     'violet',  4),   -- ประเมินราคา
  ('Listed',       'amber',   5),   -- ได้ทรัพย์ — we have it and it is being marketed
  ('Exclusive',    'crimson', 6),   -- เอ็กซ์คลูซีฟ — agreement signed
  ('Sold',         'green',   7),   -- ปิดการขาย
  ('Dropped',      'slate',   8)    -- ยกเลิก — owner withdrew or went elsewhere
on conflict (name) do nothing;

alter table public.owner_stage enable row level security;

-- Identical to pipeline_stage's: everyone reads the vocabulary, only reference managers
-- change it. Anything narrower on SELECT would leave the stage pills unable to render.
create policy p_select on public.owner_stage for select using (true);
create policy p_insert on public.owner_stage for insert with check (
  (select has_perm('reference.manage')) or (select has_perm('masterdata.govern')) or (select has_perm('roles.manage'))
);
create policy p_update on public.owner_stage for update using (
  (select has_perm('reference.manage')) or (select has_perm('masterdata.govern')) or (select has_perm('roles.manage'))
) with check (
  (select has_perm('reference.manage')) or (select has_perm('masterdata.govern')) or (select has_perm('roles.manage'))
);
create policy p_delete on public.owner_stage for delete using (
  (select has_perm('reference.manage')) or (select has_perm('masterdata.govern')) or (select has_perm('roles.manage'))
);

grant select, insert, update, delete on public.owner_stage to authenticated, service_role;;
