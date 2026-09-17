-- helper ทั้ง 4 ตัวอ่าน auth.uid() ซึ่ง anon ไม่มีอยู่แล้ว (ได้ null/ว่างเปล่า) แต่ไม่มีเหตุผล
-- ให้เปิด endpoint /rest/v1/rpc/* ทิ้งไว้ให้คนนอกยิงเล่น — ถอน execute ออกจาก anon
revoke execute on function public.current_employee_code()  from anon;
revoke execute on function public.my_permissions()         from anon;
revoke execute on function public.has_perm(text)           from anon;
revoke execute on function public.visible_employee_codes() from anon;
revoke execute on function public.zone_primary_sale(text)  from anon;

-- ปิด search_path ที่ยังเปลี่ยนได้ของ trigger function ทั้งหมด (advisor เตือน 0011)
-- ไม่ทำให้พฤติกรรมเปลี่ยน แต่กันคนที่สร้าง schema ชื่อซ้ำมาแย่ง resolve ชื่อตาราง
alter function public.set_lead_database_id()      set search_path = public;
alter function public.set_hr_employee_code()      set search_path = public;
alter function public.set_listing_id()            set search_path = public;
alter function public.set_livinginsider_date()    set search_path = public;
alter function public.set_last_match_id()         set search_path = public;
alter function public.set_project_id()            set search_path = public;
alter function public.set_updated_at()            set search_path = public;
alter function public.sync_potential_listing()    set search_path = public;
alter function public.log_listing_status_change() set search_path = public;
alter function public.zone_primary_sale(text)     set search_path = public;
alter function public.fn_sale_status(date, date)  set search_path = public;;
