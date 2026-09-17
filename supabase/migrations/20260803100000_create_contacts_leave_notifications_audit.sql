-- ============================================================
-- ผู้ติดต่อ / วันลา / แจ้งเตือน / audit
-- ============================================================

-- ผู้ติดต่อรวมทุกบทบาท (เจ้าของ/ผู้ซื้อ/ผู้เช่า/ปล่อยเช่า)
-- created_by / assigned_to = กติกาความเป็นส่วนตัว: เซลเห็นเฉพาะของตัวเอง เว้นมี contacts.view_all
create table if not exists contacts (
  id          bigint generated always as identity primary key,
  name        text not null,
  phone       text,
  line_id     text,
  email       text,
  note        text,
  created_by  text references main_1_hr (employee_code) on update cascade on delete set null,
  assigned_to text references main_1_hr (employee_code) on update cascade on delete set null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create index if not exists idx_contacts_phone   on contacts (phone);
create index if not exists idx_contacts_created on contacts (created_by);

-- 1 คนเป็นได้หลายบทบาท (เจ้าของบ้านหลังนึง + ผู้ซื้ออีกหลัง) จึงแยกตาราง
create table if not exists contact_roles (
  contact_id bigint not null references contacts (id) on delete cascade,
  role       text not null check (role in ('owner','buyer','tenant','landlord')),
  primary key (contact_id, role)
);

comment on table contacts is
  'ทรัพย์ที่ถือ (owned) และความต้องการ (demand) ไม่เก็บที่นี่ — derive จาก main_4/main_6. ตอน import ต้อง dedupe กับ main_2_owner ด้วยเบอร์โทร';

-- ---- วันลา ----
create table if not exists leave_type (name text primary key);
insert into leave_type (name) values
  ('ลาพักร้อน'),('ลากิจ'),('ลาป่วย'),('ลาคลอด'),('ลาเพื่อทำหมัน'),('อื่นๆ')
on conflict (name) do nothing;

-- โควตาระดับบริษัท (ยังไม่มี override รายคน)
create table if not exists leave_allowances (
  type          text primary key references leave_type (name) on update cascade,
  days_per_year integer,          -- null = ไม่นับโควตาปี (ลาคลอด/ทำหมัน)
  note          text
);
-- ⚠️ ตัวเลขชุดนี้เป็น "ขั้นต่ำตามกฎหมาย" ไม่ใช่นโยบายบริษัท — ชีทไม่มีคอลัมน์โควตา
-- หลักฐานว่าผิด: เทียบกับ 6 วัน/ปี มีพนักงาน 5 จาก 8 คนใช้เกินแล้วในปี 2026 (Golf 17, Pup 10)
-- ต้องขอตัวเลขจริงจาก HR ก่อนใช้งาน
insert into leave_allowances (type, days_per_year, note) values
  ('ลาพักร้อน', 6,  'ขั้นต่ำตามกฎหมาย — ยืนยันกับ HR'),
  ('ลากิจ',     3,  'ขั้นต่ำตามกฎหมาย — ยืนยันกับ HR'),
  ('ลาป่วย',    30, 'สูงสุดที่ได้รับค่าจ้าง'),
  ('ลาคลอด',    null, 'ตามกฎหมาย ไม่นับโควตาปี'),
  ('ลาเพื่อทำหมัน', null, 'ตามที่แพทย์กำหนด'),
  ('อื่นๆ',     null, 'ไม่นับโควตา')
on conflict (type) do nothing;

create table if not exists leave_requests (
  id            bigint generated always as identity primary key,
  employee_code text not null references main_1_hr (employee_code) on update cascade on delete cascade,
  submitted_at  timestamptz default now(),
  start_date    date not null,
  end_date      date not null,
  type          text not null references leave_type (name) on update cascade,
  remark        text,
  -- ชีทต้นทางไม่มีคอลัมน์อนุมัติเลย — CRM เพิ่มขั้นตอนนี้ใหม่ (Ben, 2026-08-01)
  status        text not null default 'pending' check (status in ('pending','approved','rejected')),
  decided_by    text references main_1_hr (employee_code) on update cascade on delete set null,
  decided_at    timestamptz,
  created_at    timestamptz default now(),
  -- ชีทมีแถวที่วันเริ่มอยู่หลังวันสิ้นสุด (Golf 09/10 -> 20/06) กันไว้ไม่ให้เข้ามาอีก
  constraint leave_date_order check (start_date <= end_date)
);
-- ชีทมีแถวซ้ำเป๊ะ 2 แถว (Golf ลาเพื่อทำหมัน 14/08) — กันนับซ้ำตั้งแต่ import
create unique index if not exists uq_leave_dedupe
  on leave_requests (employee_code, start_date, end_date, type);
create index if not exists idx_leave_emp on leave_requests (employee_code);

comment on column leave_requests.status is
  'โควตาหักเฉพาะ approved — ใบที่รออนุมัติต้องไม่กินโควตาไปก่อน';

-- ---- แจ้งเตือน ----
-- ไม่มี permission gate: ทุกคนมีกระดิ่ง การกรองแถว (RLS) คือความปลอดภัยทั้งหมด
-- ⚠️ body ของ deal_won มีมูลค่าดีล ถ้า scope ผิดคือหลุดตัวเลขเงินที่ financials.view_comp กันไว้
create table if not exists notifications (
  id            bigint generated always as identity primary key,
  employee_code text not null references main_1_hr (employee_code) on update cascade on delete cascade,
  type          text not null check (type in (
                  'lead_assigned','lead_stage_changed','deal_won','task_due',
                  'target_milestone','listing_new_in_zone','listing_price_changed')),
  title         text not null,
  body          text,
  entity        text check (entity is null or entity in ('lead','listing','task','target')),
  entity_id     text,
  actor         text,          -- ชื่อเล่นคนที่ทำให้เกิด (ว่าง = ระบบสร้างเอง)
  created_at    timestamptz default now(),
  read_at       timestamptz    -- null = ยังไม่อ่าน
);
create index if not exists idx_notifications_emp on notifications (employee_code, created_at desc);

comment on table notifications is
  'ข้อความเก็บเป็นข้อความสำเร็จรูป (ไม่ใช่ template) — แก้คำทีหลังไม่ย้อนไปแถวเก่า และตัวเลขค้างไว้ตามตอนสร้าง';

-- ---- audit ----
create table if not exists audit_log (
  id          bigint generated always as identity primary key,
  entity      text not null,      -- 'lead' | 'listing' | 'employee' | ...
  entity_id   text not null,
  action      text not null,      -- 'assign' | 'update' | 'delete' | ...
  changed_by  text references main_1_hr (employee_code) on update cascade on delete set null,
  before      jsonb,
  after       jsonb,
  remark      text,
  created_at  timestamptz default now()
);
create index if not exists idx_audit_entity on audit_log (entity, entity_id, created_at desc);

-- ============================================================
-- เปิด RLS ทุกตารางใหม่ทันที (ไม่งั้น anon เขียน/ลบได้)
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'action_type','targets','tasks','activities','user_quick_actions',
    'contacts','contact_roles','leave_type','leave_allowances','leave_requests',
    'notifications','audit_log'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists demo_read_all on %I', t);
    execute format('create policy demo_read_all on %I for select to anon, authenticated using (true)', t);
  end loop;
end $$;;
