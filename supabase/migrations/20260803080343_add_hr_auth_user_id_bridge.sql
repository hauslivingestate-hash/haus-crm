-- สะพานระหว่าง Supabase Auth กับตารางพนักงาน
-- ทุก policy ของ RLS จะวิ่งผ่านตรงนี้: auth.uid() -> employee_code
alter table main_1_hr
  add column if not exists auth_user_id uuid unique references auth.users (id) on delete set null;

comment on column main_1_hr.auth_user_id is
  'บัญชี login ของพนักงานคนนี้ (auth.users.id). null = ยังไม่มีบัญชี เช่นพนักงานที่ลาออกแล้ว';

-- helper: แปลง session ปัจจุบัน -> employee_code
-- security definer เพราะตอนเปิด RLS จริง policy ต้องอ่าน main_1_hr ได้ก่อนที่ policy จะทำงาน
create or replace function current_employee_code()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select employee_code from main_1_hr where auth_user_id = auth.uid()
$$;

comment on function current_employee_code() is
  'employee_code ของ user ที่ login อยู่ — ใช้ใน RLS policy ทุกตัวที่กรองตาม sale_id/support_id';

revoke execute on function current_employee_code() from public;
grant execute on function current_employee_code() to authenticated;;
