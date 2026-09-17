-- 17 คอลัมน์ที่ชีท Listings มีแต่ DB ยังไม่มี
-- ต้องเพิ่มก่อน import เพราะชีทจะเลิกใช้ ไม่มีรอบสอง
alter table main_4_listing_database
  -- กลุ่ม A: งานการตลาด (CEO ขอ)
  add column if not exists dd_boost          date,
  add column if not exists lv_boost          date,
  add column if not exists fb_repost         date,
  add column if not exists marketing_report  text,
  add column if not exists facebook_ad_link  text,
  add column if not exists new_photo_link    text,
  -- กลุ่ม B: ลิงก์/ข้อมูลที่ตกหล่น
  add column if not exists hook              text,
  add column if not exists photo_album_link  text,
  add column if not exists link              text,
  -- กลุ่ม C: Last Match ที่ผูกกับทรัพย์หลังนี้ (คนละอันกับตาราง main_7_last_match)
  add column if not exists last_match        text,
  add column if not exists last_match_type   text,
  add column if not exists last_match_price  numeric,
  add column if not exists last_match_remark text,
  -- กลุ่ม D1: ส่วนกลาง — เก็บเป็น "เรต" เพราะชีทปน 3 หน่วย (45 บาท/ตร.ว./เดือน, 44,000/ปี, เดือนละ 2,024)
  add column if not exists common_fee_rate   numeric,
  add column if not exists common_fee_unit   text,
  add column if not exists common_fee_note   text,
  -- กลุ่ม D2: อายุ -> เก็บปีที่สร้าง (อายุคำนวณตอนแสดงผล ไม่งั้นข้อมูลผิดเองทุกปี)
  add column if not exists built_year        integer;

alter table main_4_listing_database
  drop constraint if exists main_4_common_fee_unit_check,
  add  constraint main_4_common_fee_unit_check
       check (common_fee_unit is null or common_fee_unit in ('per_wa_month','per_sqm_month'));

alter table main_4_listing_database
  drop constraint if exists main_4_built_year_check,
  add  constraint main_4_built_year_check
       check (built_year is null or built_year between 1900 and 2200);

comment on column main_4_listing_database.common_fee_rate is 'เรตค่าส่วนกลาง (บาท/หน่วยพื้นที่/เดือน) — ยอดรวมให้เว็บคูณพื้นที่เอง';
comment on column main_4_listing_database.common_fee_unit is 'per_wa_month = บาท/ตร.ว./เดือน (บ้าน) | per_sqm_month = บาท/ตร.ม./เดือน (คอนโด)';
comment on column main_4_listing_database.common_fee_note is 'ข้อความส่วนกลางดิบจากชีท เก็บไว้กันข้อมูลหายตอนแปลงหน่วย';
comment on column main_4_listing_database.built_year      is 'ปีที่สร้าง (ค.ศ.) — ชีทเก็บเป็น "N ปี" แปลงตอน import คลาดเคลื่อน ±1 ปี';
comment on column main_4_listing_database.last_match      is 'การปิดใกล้เคียงของทรัพย์หลังนี้ (ติดกับ listing) — คนละอันกับตาราง main_7_last_match';

-- view ผูกคอลัมน์ตอนสร้าง: l.* จะไม่รับคอลัมน์ใหม่จนกว่าจะสร้างใหม่
-- และ create or replace ใช้ไม่ได้เพราะคอลัมน์ใหม่แทรกกลางลิสต์ ต้อง drop ก่อน
drop view if exists v_support_listing;
drop view if exists v_main_listing;

create view v_main_listing
with (security_invoker = true) as
select
  l.*,
  p.project_name_thai as listing_name,
  p.project_name_eng  as project_name_eng,
  z.name_thai as zone_name_thai,
  z.name_eng  as zone_name_eng,
  o.owner_name, o.owner_phone, o.owner_line,
  case when l.livinginsider_date is not null
       then (current_date - l.livinginsider_date) end as days_on_market
from main_4_listing_database l
left join main_3_property_detail p on p.project_id = l.project_id
left join main_2_owner o on o.owner_id = l.owner_id
left join zone       z on z.zone_id  = l.zone;

create view v_support_listing
with (security_invoker = true) as
select *
from v_main_listing
where listing_status in ('Ready to Post', 'Cancel', 'Update', 'Sold');

-- drop view ทำให้ policy หายไปด้วย ต้องคืน demo_read_all (ยังปิดไม่ได้ รอ auth)
grant select on v_main_listing, v_support_listing to anon, authenticated;;
