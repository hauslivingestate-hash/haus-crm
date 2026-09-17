-- ลิงก์ Google Sheet รายคน (ชีท HR คอลัมน์ U "Sheet ID (Sales)")
-- บางคนมีหลายลิงก์คั่นด้วย comma — เก็บดิบไว้ก่อน ใช้ตอน backfill ว่าทรัพย์หลังไหนของเซลคนไหน
alter table main_1_hr add column if not exists sales_sheet_url text;
comment on column main_1_hr.sales_sheet_url is
  'ลิงก์ชีทรายคนจาก HR Sheet — ใช้หาว่า listing ไหนเป็นของเซลคนไหน (created_by ในชีททรัพย์เป็น Stone ทั้งหมด)';;
