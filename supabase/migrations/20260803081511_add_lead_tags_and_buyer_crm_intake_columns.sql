-- แท็กกลุ่มลูกค้า — CEO กำหนดรายการ, 1 ลีดติดได้ 1 แท็ก (ไม่ใช้ join table)
-- ข้อยกเว้นจาก convention "lookup ใช้ name เป็น PK": ตารางนี้ใช้ id
-- เพราะ CEO เปลี่ยนชื่อแท็กได้ + สีถูกเก็บไว้ ถ้าใช้ชื่อเป็น PK พอเปลี่ยนชื่อแถวเดิมจะหลุด
create table if not exists lead_tags_ref (
  id         text primary key,
  label      text not null,
  tone       text not null default 'neutral'
             check (tone in ('accent','blue','violet','amber','green','neutral')),
  sort_order integer default 0,
  is_active  boolean default true,
  created_at timestamptz default now()
);

comment on table lead_tags_ref is
  'แท็กกลุ่มลูกค้า แก้ได้ที่ ตั้งค่า > แท็ก Lead (สิทธิ์ masterdata.govern). ลบให้ใช้ is_active=false แทน hard delete';

-- seed ชั่วคราว รอ CEO ตั้งจริง — เป็นแกน "ลูกค้าประเภทไหน" ไม่ใช่ร้อน/อุ่น/เย็น
-- (ความร้อนใช้คอลัมน์ potential A/B/C อยู่แล้ว จะซ้ำกัน)
insert into lead_tags_ref (id, label, tone, sort_order) values
  ('investor',  'นักลงทุน',   'violet', 1),
  ('own_stay',  'ซื้ออยู่เอง', 'green',  2),
  ('rent_out',  'ปล่อยเช่า',   'blue',   3),
  ('foreigner', 'ต่างชาติ',    'amber',  4)
on conflict (id) do nothing;

alter table lead_tags_ref enable row level security;
drop policy if exists demo_read_all on lead_tags_ref;
create policy demo_read_all on lead_tags_ref for select to anon, authenticated using (true);

-- คอลัมน์ที่ฟอร์ม intake เก็บอยู่แล้วแต่ไม่มีที่ลง
alter table main_6_buyer_crm
  add column if not exists tag_id                  text references lead_tags_ref (id)      on update cascade,
  add column if not exists marketing_channel       text references marketing_channel (name) on update cascade,
  add column if not exists marketing_channel_other text,
  add column if not exists contact_by              text references contact_by (name)        on update cascade,
  add column if not exists gender                  text references gender (name)            on update cascade,
  add column if not exists nationality             text references nationality (name)       on update cascade,
  add column if not exists contact_date            date,
  add column if not exists contact_time            time,
  add column if not exists customer_complain       text,
  add column if not exists complain_status         text references complain_status (name)   on update cascade,
  add column if not exists complain_remark         text;

comment on column main_6_buyer_crm.tag_id is 'แท็กกลุ่มลูกค้า 1 อันต่อลีด — ตั้งชื่อคอลัมน์ตรงกับ main_5_lead_database ให้เหมือนกันทั้ง DB';
comment on column main_6_buyer_crm.marketing_channel is 'ช่องทางที่ลูกค้าเข้ามา — แอปเรียกฟิลด์นี้ว่า source';;
