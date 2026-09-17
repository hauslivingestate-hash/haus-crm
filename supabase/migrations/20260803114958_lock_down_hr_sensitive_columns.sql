-- ============================================================
-- ปิดรูรั่ว: เงินเดือน / คอมมิชชั่น / PII ของพนักงาน
--
-- ปัญหา: anon key ฝังอยู่ในหน้าเว็บ + policy demo_read_all ให้อ่านได้ทุกแถว
--        => ใครก็ดึง main_1_hr ทั้งตารางได้ รวมเงินเดือน เลขบัตร ปชช. เลขบัญชี
--
-- วิธีแก้: RLS เป็น "ระดับแถว" กรอง "คอลัมน์" ไม่ได้ -> ใช้ GRANT ระดับคอลัมน์แทน
--        คอลัมน์อ่อนไหว 6 ตัวถูกถอนสิทธิ์จาก anon + authenticated ทั้งคู่
--        ใครจะดูต้องผ่าน view v_employee_private ที่เช็ค has_perm() ให้ทีละคอลัมน์
-- ============================================================

revoke select on main_1_hr from anon, authenticated;

-- คอลัมน์ที่ไม่อ่อนไหว — ยังให้อ่านได้ (เป็นสมุดรายชื่อภายในบริษัท)
-- ⚠️ ยังให้ anon อ่านอยู่ เพราะ lib/queries.ts ยังยิงด้วย anon client (v_sale_status ต้องใช้)
--    พอย้าย queries ไป session client แล้ว (Phase 4) ให้ถอน anon ออกทั้งหมด
grant select (
  employee_code, status, division, position, second_position,
  first_name_en, last_name_en, first_name_th, last_name_th, nickname,
  gender, nationality, phone, additional_phone,
  email, work_email, birthday, date_started,
  emergency_contact, emergency_contact_phone, emergency_contact_relationship,
  remark, line_userid, sales_sheet_url, team_id, auth_user_id, created_at
) on main_1_hr to anon, authenticated;

-- ไม่ให้ใคร (ผ่าน API) เลย: salary, commission, id_card_no, kbank_account,
--                          payslip_drive, agreement_files

-- ---- ช่องทางเดียวที่จะดูข้อมูลอ่อนไหวได้ ----
-- ⚠️ ตั้งใจ "ไม่ใส่" security_invoker (ต่างจาก view อื่นในโปรเจกต์นี้)
--    เพราะ view ต้องรันด้วยสิทธิ์เจ้าของถึงจะอ่านคอลัมน์ที่เพิ่งถอนสิทธิ์ไปได้
--    การกรองจริงอยู่ที่ has_perm() ทีละคอลัมน์ ไม่มีสิทธิ์ = ได้ null
create or replace view v_employee_private as
select
  employee_code,
  nickname,
  case when has_perm('financials.view_comp')  then salary          end as salary,
  case when has_perm('financials.view_comp')  then commission      end as commission,
  case when has_perm('people.view_sensitive') then id_card_no      end as id_card_no,
  case when has_perm('people.view_sensitive') then kbank_account   end as kbank_account,
  case when has_perm('people.view_sensitive') then payslip_drive   end as payslip_drive,
  case when has_perm('people.view_sensitive') then agreement_files end as agreement_files
from main_1_hr;

revoke all on v_employee_private from anon;
grant select on v_employee_private to authenticated;

comment on view v_employee_private is
  'ข้อมูลอ่อนไหวของพนักงาน — กรองด้วย has_perm() ทีละคอลัมน์. anon เข้าไม่ได้เลย. ต้องไม่ใส่ security_invoker';;
