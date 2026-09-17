-- เบอร์/ไลน์เจ้าของ = PII ที่ต้องกันจริง ไม่ใช่แค่ไม่แสดงคอลัมน์ในหน้า "ทรัพย์ทั้งบริษัท"
-- (ข้อมูลถูกส่งไปถึงเบราว์เซอร์อยู่ดี + ยิง REST ตรงก็ได้) → กันที่ RLS
--
-- เห็นเจ้าของได้เมื่อ: เป็นคนดูแลทรัพย์ของเจ้าของรายนั้น · หรือมี contacts.view_all
-- (admin / listing_support / sales_leader / CEO — งานที่ต้องติดต่อข้ามทีม)
--
-- v_main_listing ใช้ LEFT JOIN main_2_owner → คนที่ไม่มีสิทธิ์จะได้ owner_name/phone/line
-- เป็น null แต่ "แถวทรัพย์ยังอยู่ครบ" ซึ่งเป็นพฤติกรรมที่หน้าทรัพย์ทั้งบริษัทต้องการพอดี
drop policy if exists p_select on public.main_2_owner;
create policy p_select on public.main_2_owner for select to authenticated
  using (
    (select has_perm('contacts.view_all'))
    or (select has_perm('roles.manage'))
    or exists (
      select 1 from public.main_4_listing_database l
      where l.owner_id = main_2_owner.owner_id
        and coalesce(l.sale_id, zone_primary_sale(l.zone)) = (select current_employee_code())
    )
  );

-- policy ข้างบนวิ่ง exists ต่อเจ้าของ 1 ราย → ต้องมี index ไม่งั้นสแกนทั้งตารางทุกแถว
create index if not exists idx_main_4_owner_id on public.main_4_listing_database (owner_id);
create index if not exists idx_main_4_sale_id  on public.main_4_listing_database (sale_id);;
