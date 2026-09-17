-- สัญญา Exclusive — ช่วงเวลาที่เรารับปากว่าจะขายให้ได้ ใช้เตือนก่อนหมดอายุ
-- เดิมอยู่ใน ChecklistProvider (in-memory) → กรอกวันหมดสัญญาแล้วรีเฟรชหาย
-- อยู่บน main_4 ไม่ใช่ main_10 เพราะเป็นข้อเท็จจริงของทรัพย์ ไม่ใช่ของสถานะ A-List ที่หลุดเข้าออกได้
-- (main_10 ถูก trigger ลบแถวทิ้งเมื่อทรัพย์หลุดเกณฑ์ — วันหมดสัญญาจะหายไปด้วย)
alter table public.main_4_listing_database
  add column if not exists agreement_start date,
  add column if not exists agreement_end   date;

comment on column public.main_4_listing_database.agreement_start is 'วันเริ่มสัญญา Exclusive';
comment on column public.main_4_listing_database.agreement_end   is 'วันหมดสัญญา Exclusive — ใช้เตือนก่อนหมดอายุ';

-- ⚠️ main_4 ไม่ได้ถูก revoke ระดับตารางเหมือน main_1_hr จึงไม่ต้อง grant รายคอลัมน์
-- แต่ view v_main_listing ต้องเพิ่มคอลัมน์เอง ไม่งั้นหน้าทรัพย์อ่านไม่เห็น (ทำแยกด้านล่าง);
