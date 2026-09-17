-- ============================================================
-- เทมเพลตคำโฆษณา + เทมเพลต KPI — 2 ใน 3 หน้าตั้งค่าที่ยังไม่มีตารางเก็บ
-- ============================================================

-- ── 1) เทมเพลตคำโฆษณา ────────────────────────────────────────
-- ⚠️ ตารางนี้เก็บ "เฉพาะอันที่แก้แล้ว" ไม่ได้เก็บครบ 9 ช่อง
--    ค่าตั้งต้นอยู่ในโค้ด (lib/listingCopy.ts defaultTemplate) และเป็น fallback เสมอ
--    → ตารางว่าง = คำโฆษณายังออกถูกทุกช่อง · "คืนค่าเริ่มต้น" = ลบแถวทิ้ง
--    → ช่องที่ไม่มีใครแก้จะได้อานิสงส์เวลาปรับค่าตั้งต้นในโค้ด แทนที่จะค้างอยู่กับสำเนาเก่า
-- grade/copy_type เป็นค่าที่ normalize แล้วในโค้ด (potentialGroup) ไม่ใช่ค่าดิบใน listing_potential
-- จึงใช้ check ไม่ใช่ FK — "A List + Fb add" กับ "A List" ยุบเป็น a_list ช่องเดียวกัน
create table if not exists public.listing_copy_template (
  grade        text not null check (grade in ('exclusive','a_list','normal')),
  copy_type    text not null check (copy_type in ('sale','rent','both')),
  headline     text not null,
  normal_body  text not null,
  dd_body      text not null,
  updated_at   timestamptz default now(),
  updated_by   text references public.main_1_hr(employee_code) on update cascade,
  primary key (grade, copy_type)
);

comment on table public.listing_copy_template is
  'คำโฆษณาที่แก้ทับค่าตั้งต้นในโค้ด — เก็บเฉพาะช่อง grade×type ที่มีคนแก้จริง';

-- ── 2) เทมเพลต KPI ───────────────────────────────────────────
-- ชุดเป้าหมายสำเร็จรูปที่หัวหน้าหยิบไปตั้งให้ลูกทีม — แต่ละแถวคือ "แบบ" ของ targets 1 แถว
-- id สร้างใหม่ ไม่ derive จาก label (บทเรียนเดียวกับ role/แท็กลีด: เปลี่ยนชื่อแล้วต้องไม่หลุด)
create table if not exists public.kpi_template (
  id             bigint generated always as identity primary key,
  label          text not null,
  kind           text not null default 'count' check (kind in ('count','baht','check')),
  source         text not null default 'activity' check (source in ('activity','pipeline','manual')),
  -- FK เพื่อให้เปลี่ยนชื่อกิจกรรมแล้วเทมเพลตตามไปเอง (on update cascade)
  -- และเพื่อไม่ให้เทมเพลตชี้ไปกิจกรรมที่ถูกลบไปแล้ว
  activity_type  text references public.action_type(name) on update cascade,
  default_target numeric not null default 0,
  sort           int not null default 0,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),
  -- source='activity' ต้องมีกิจกรรม · แบบอื่นต้องไม่มี (ไม่งั้นค่าที่ค้างไว้จะไปโผล่ตอนสลับกลับ)
  constraint kpi_template_activity_coherent check (
    (source = 'activity' and activity_type is not null) or
    (source <> 'activity' and activity_type is null)
  )
);

comment on table public.kpi_template is
  'แบบเป้าหมาย KPI ที่หัวหน้าใช้ตั้งเป้าให้ลูกทีม — โครงเดียวกับตาราง targets';

-- ── RLS ──────────────────────────────────────────────────────
-- อ่านได้ทุกคนที่ล็อกอิน (ทั้ง 2 ตัวป้อนหน้าจอที่คนทั่วไปใช้: ปุ่มสร้างคำโฆษณา / ตั้งเป้า)
-- เขียนได้เฉพาะคนที่ถือสิทธิ์ของหน้านั้น ตัวเดียวกับที่ sub-nav ใช้ซ่อนเมนู
alter table public.listing_copy_template enable row level security;
alter table public.kpi_template          enable row level security;
revoke all on public.listing_copy_template from anon;
revoke all on public.kpi_template          from anon;
grant select, insert, update, delete on public.listing_copy_template to authenticated;
grant select, insert, update, delete on public.kpi_template          to authenticated;
grant usage, select on all sequences in schema public to authenticated;

drop policy if exists p_select on public.listing_copy_template;
drop policy if exists p_insert on public.listing_copy_template;
drop policy if exists p_update on public.listing_copy_template;
drop policy if exists p_delete on public.listing_copy_template;
create policy p_select on public.listing_copy_template for select to authenticated using (true);
create policy p_insert on public.listing_copy_template for insert to authenticated
  with check ((select has_perm('copy.manage')) or (select has_perm('roles.manage')));
create policy p_update on public.listing_copy_template for update to authenticated
  using      ((select has_perm('copy.manage')) or (select has_perm('roles.manage')))
  with check ((select has_perm('copy.manage')) or (select has_perm('roles.manage')));
create policy p_delete on public.listing_copy_template for delete to authenticated
  using ((select has_perm('copy.manage')) or (select has_perm('roles.manage')));

drop policy if exists p_select on public.kpi_template;
drop policy if exists p_insert on public.kpi_template;
drop policy if exists p_update on public.kpi_template;
drop policy if exists p_delete on public.kpi_template;
create policy p_select on public.kpi_template for select to authenticated using (true);
create policy p_insert on public.kpi_template for insert to authenticated
  with check ((select has_perm('masterdata.govern')) or (select has_perm('roles.manage')));
create policy p_update on public.kpi_template for update to authenticated
  using      ((select has_perm('masterdata.govern')) or (select has_perm('roles.manage')))
  with check ((select has_perm('masterdata.govern')) or (select has_perm('roles.manage')));
create policy p_delete on public.kpi_template for delete to authenticated
  using ((select has_perm('masterdata.govern')) or (select has_perm('roles.manage')));

-- ── seed KPI ─────────────────────────────────────────────────
-- seed ตรงกับ KPI_TEMPLATES เดิมใน lib/masterdata.ts เป๊ะ (ของเดิมอยู่ในโค้ด CEO แก้แล้วหาย)
-- ⚠️ "Reels" ไม่มีใน action_type จริง → ใช้ "Live/Reels" ที่มีจริง ไม่งั้น FK ปฏิเสธ
insert into public.kpi_template (label, kind, source, activity_type, default_target, sort)
select v.label, v.kind, v.source, v.activity_type, v.default_target, v.sort
from (values
  ('โทรหาลูกค้า',  'count','activity', 'Call',        30,  1),
  ('พาชม',        'count','activity', 'Show',        10,  2),
  ('เยี่ยมเจ้าของ', 'count','activity', 'Owner Visit', 12,  3),
  ('ปิดการขาย',    'count','pipeline',  null,          3,  5),
  ('คอมมิชชั่น',   'baht', 'pipeline',  null,     500000,  6)
) as v(label, kind, source, activity_type, default_target, sort)
where not exists (select 1 from public.kpi_template);;
