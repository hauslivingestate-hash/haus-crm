-- ============================================================
-- helper ที่ RLS policy ทุกตัวจะเรียกใช้
-- security definer: policy ต้องอ่าน user_roles/main_1_hr ได้ ก่อนที่ policy ของตารางนั้นจะทำงาน
-- ============================================================

-- สิทธิ์ทั้งหมดของคนที่ login อยู่ = union ของทุก role ที่ถือ
create or replace function my_permissions()
returns setof text language sql stable security definer set search_path = public as $$
  select distinct rp.permission_key
  from main_1_hr h
  join user_roles      ur on ur.employee_code = h.employee_code
  join role_permissions rp on rp.role_id       = ur.role_id
  where h.auth_user_id = auth.uid()
$$;

create or replace function has_perm(p text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from my_permissions() k where k = p)
$$;

-- employee_code ที่คนนี้ "มีสิทธิ์เห็นข้อมูลของ" — own / team / all
--   org-wide (roles.manage หรือ people.manage) -> ทุกคน       เช่น CEO, HR
--   หัวหน้าทีม (teams.leader_code = ตัวเอง)      -> ทั้งทีม     เช่น Sales Leader
--   ที่เหลือ                                     -> ตัวเองคนเดียว
create or replace function visible_employee_codes()
returns setof text language sql stable security definer set search_path = public as $$
  with me as (
    select employee_code, team_id from main_1_hr where auth_user_id = auth.uid()
  )
  select h.employee_code
  from main_1_hr h
  where has_perm('roles.manage') or has_perm('people.manage')
     or h.employee_code = (select employee_code from me)
     or exists (
          select 1 from teams t
          where t.leader_code = (select employee_code from me)
            and h.team_id = t.id
        )
$$;

comment on function my_permissions()         is 'สิทธิ์ทั้งหมดของ user ที่ login (union ทุก role)';
comment on function has_perm(text)           is 'เช็คสิทธิ์เดียว — ใช้ใน RLS policy: using (has_perm(''listings.view''))';
comment on function visible_employee_codes() is 'รายชื่อ employee_code ที่คนนี้เห็นข้อมูลได้ (own/team/all) — ใช้กับ last match, ผลงาน, lead';

revoke execute on function my_permissions(), has_perm(text), visible_employee_codes() from public;
grant  execute on function my_permissions(), has_perm(text), visible_employee_codes() to authenticated;

-- ============================================================
-- ⚠️ ตารางใหม่ที่ยังไม่เปิด RLS = anon เขียน/ลบได้ (Supabase grant ให้ anon by default)
-- ปิดช่องนี้ทันที: เปิด RLS + ให้อ่านอย่างเดียว (แบบเดียวกับ demo_read_all ของตารางอื่น)
-- Phase 4 ค่อยเปลี่ยนเป็น policy จริงพร้อมกันทั้งระบบ
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['permissions','roles','role_permissions','teams','user_roles']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists demo_read_all on %I', t);
    execute format('create policy demo_read_all on %I for select to anon, authenticated using (true)', t);
  end loop;
end $$;;
