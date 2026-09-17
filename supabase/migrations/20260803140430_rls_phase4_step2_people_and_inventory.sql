-- Phase 4 RLS step 2/5 — พนักงาน/ทีม/บทบาท + คลังทรัพย์
do $do$
declare t text;
begin
  foreach t in array array['main_1_hr','teams','user_roles','main_4_listing_database',
                           'main_3_property_detail','main_2_owner','main_8_listing_photo',
                           'main_9_support_log','main_10_potential_listing','main_11_potential_listing_log'] loop
    execute format('drop policy if exists p_select on public.%I', t);
    execute format('drop policy if exists p_insert on public.%I', t);
    execute format('drop policy if exists p_update on public.%I', t);
    execute format('drop policy if exists p_delete on public.%I', t);
  end loop;
end
$do$;

-- main_1_hr: ล็อกอินแล้วเห็นทำเนียบพนักงานได้ — เงินเดือน/PII กันด้วย GRANT ระดับคอลัมน์ (ทำไปแล้ว)
create policy p_select on public.main_1_hr for select to authenticated using (true);
create policy p_insert on public.main_1_hr for insert to authenticated
  with check ((select has_perm('people.manage')) or (select has_perm('roles.manage')));
create policy p_update on public.main_1_hr for update to authenticated
  using      ((select has_perm('people.manage')) or (select has_perm('roles.manage')))
  with check ((select has_perm('people.manage')) or (select has_perm('roles.manage')));
create policy p_delete on public.main_1_hr for delete to authenticated
  using ((select has_perm('roles.manage')));

create policy p_select on public.teams for select to authenticated using (true);
create policy p_insert on public.teams for insert to authenticated
  with check ((select has_perm('teams.manage')) or (select has_perm('roles.manage')));
create policy p_update on public.teams for update to authenticated
  using      ((select has_perm('teams.manage')) or (select has_perm('roles.manage')))
  with check ((select has_perm('teams.manage')) or (select has_perm('roles.manage')));
create policy p_delete on public.teams for delete to authenticated
  using ((select has_perm('teams.manage')) or (select has_perm('roles.manage')));

-- ใครถือสิทธิ์อะไร = ข้อมูลอ่อนไหว (lib/auth.ts อ่านของตัวเองผ่าน policy นี้)
create policy p_select on public.user_roles for select to authenticated
  using (employee_code = (select current_employee_code())
         or (select has_perm('roles.manage')) or (select has_perm('people.manage')));
create policy p_insert on public.user_roles for insert to authenticated
  with check ((select has_perm('roles.manage')));
create policy p_update on public.user_roles for update to authenticated
  using ((select has_perm('roles.manage'))) with check ((select has_perm('roles.manage')));
create policy p_delete on public.user_roles for delete to authenticated
  using ((select has_perm('roles.manage')));

-- ทรัพย์ = ของบริษัท ใครมี listings.view เห็นหมด แต่ "แก้" ต้องมีสิทธิ์แยก
create policy p_select on public.main_4_listing_database for select to authenticated
  using ((select has_perm('listings.view')));
create policy p_insert on public.main_4_listing_database for insert to authenticated
  with check ((select has_perm('listings.create')) or (select has_perm('roles.manage')));
create policy p_update on public.main_4_listing_database for update to authenticated
  using      ((select has_perm('listings.edit')) or (select has_perm('listings.marketing')) or (select has_perm('roles.manage')))
  with check ((select has_perm('listings.edit')) or (select has_perm('listings.marketing')) or (select has_perm('roles.manage')));
create policy p_delete on public.main_4_listing_database for delete to authenticated
  using ((select has_perm('roles.manage')));

create policy p_select on public.main_3_property_detail for select to authenticated
  using ((select has_perm('listings.view')));
create policy p_insert on public.main_3_property_detail for insert to authenticated
  with check ((select has_perm('projects.edit')) or (select has_perm('listings.create')) or (select has_perm('roles.manage')));
create policy p_update on public.main_3_property_detail for update to authenticated
  using      ((select has_perm('projects.edit')) or (select has_perm('roles.manage')))
  with check ((select has_perm('projects.edit')) or (select has_perm('roles.manage')));
create policy p_delete on public.main_3_property_detail for delete to authenticated
  using ((select has_perm('roles.manage')));

-- เจ้าของทรัพย์ (เบอร์/ไลน์ = PII) — ใครดูทรัพย์ได้ก็ต้องติดต่อเจ้าของได้
create policy p_select on public.main_2_owner for select to authenticated
  using ((select has_perm('listings.view')) or (select has_perm('contacts.view_all')));
create policy p_insert on public.main_2_owner for insert to authenticated
  with check ((select has_perm('listings.create')) or (select has_perm('listings.edit')) or (select has_perm('roles.manage')));
create policy p_update on public.main_2_owner for update to authenticated
  using      ((select has_perm('listings.edit')) or (select has_perm('roles.manage')))
  with check ((select has_perm('listings.edit')) or (select has_perm('roles.manage')));
create policy p_delete on public.main_2_owner for delete to authenticated
  using ((select has_perm('roles.manage')));

create policy p_select on public.main_8_listing_photo for select to authenticated
  using ((select has_perm('listings.view')));
create policy p_insert on public.main_8_listing_photo for insert to authenticated
  with check ((select has_perm('listings.edit')) or (select has_perm('listings.marketing')) or (select has_perm('listings.create')) or (select has_perm('roles.manage')));
create policy p_update on public.main_8_listing_photo for update to authenticated
  using      ((select has_perm('listings.edit')) or (select has_perm('listings.marketing')) or (select has_perm('roles.manage')))
  with check ((select has_perm('listings.edit')) or (select has_perm('listings.marketing')) or (select has_perm('roles.manage')));
create policy p_delete on public.main_8_listing_photo for delete to authenticated
  using ((select has_perm('listings.edit')) or (select has_perm('listings.marketing')) or (select has_perm('roles.manage')));

-- ⚠️ main_9/10/11 เขียนโดย trigger ที่ไม่ใช่ security definer → ต้องกว้างเท่าสิทธิ์แก้ทรัพย์
create policy p_select on public.main_9_support_log for select to authenticated
  using ((select has_perm('listings.view')));
create policy p_insert on public.main_9_support_log for insert to authenticated
  with check ((select has_perm('listings.create')) or (select has_perm('listings.edit')) or (select has_perm('listings.marketing')) or (select has_perm('roles.manage')));
create policy p_update on public.main_9_support_log for update to authenticated
  using ((select has_perm('roles.manage'))) with check ((select has_perm('roles.manage')));
create policy p_delete on public.main_9_support_log for delete to authenticated
  using ((select has_perm('roles.manage')));

create policy p_select on public.main_10_potential_listing for select to authenticated
  using ((select has_perm('listings.view')));
create policy p_insert on public.main_10_potential_listing for insert to authenticated
  with check ((select has_perm('listings.create')) or (select has_perm('listings.edit')) or (select has_perm('listings.marketing')) or (select has_perm('roles.manage')));
create policy p_update on public.main_10_potential_listing for update to authenticated
  using      ((select has_perm('listings.create')) or (select has_perm('listings.edit')) or (select has_perm('listings.marketing')) or (select has_perm('roles.manage')))
  with check ((select has_perm('listings.create')) or (select has_perm('listings.edit')) or (select has_perm('listings.marketing')) or (select has_perm('roles.manage')));
create policy p_delete on public.main_10_potential_listing for delete to authenticated
  using ((select has_perm('listings.create')) or (select has_perm('listings.edit')) or (select has_perm('listings.marketing')) or (select has_perm('roles.manage')));

create policy p_select on public.main_11_potential_listing_log for select to authenticated
  using ((select has_perm('listings.view')));
create policy p_insert on public.main_11_potential_listing_log for insert to authenticated
  with check ((select has_perm('listings.create')) or (select has_perm('listings.edit')) or (select has_perm('listings.marketing')) or (select has_perm('roles.manage')));
create policy p_update on public.main_11_potential_listing_log for update to authenticated
  using ((select has_perm('roles.manage'))) with check ((select has_perm('roles.manage')));
create policy p_delete on public.main_11_potential_listing_log for delete to authenticated
  using ((select has_perm('roles.manage')));;
