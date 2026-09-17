-- Phase 4 RLS step 3/5 — Lead / ดีล / ผู้ติดต่อ (จุดที่ own vs all ต่างกันจริง)
do $do$
declare t text;
begin
  foreach t in array array['main_5_lead_database','main_6_buyer_crm','main_7_last_match',
                           'contacts','contact_roles'] loop
    execute format('drop policy if exists p_select on public.%I', t);
    execute format('drop policy if exists p_insert on public.%I', t);
    execute format('drop policy if exists p_update on public.%I', t);
    execute format('drop policy if exists p_delete on public.%I', t);
  end loop;
end
$do$;

create policy p_select on public.main_5_lead_database for select to authenticated
  using ((select has_perm('leads.view_all'))
         or ((select has_perm('leads.view_own')) and sales_id = (select current_employee_code())));
create policy p_insert on public.main_5_lead_database for insert to authenticated
  with check ((select has_perm('leads.create')) or (select has_perm('roles.manage')));
create policy p_update on public.main_5_lead_database for update to authenticated
  using      ((select has_perm('leads.edit')) or (select has_perm('leads.assign')) or (select has_perm('roles.manage')))
  with check ((select has_perm('leads.edit')) or (select has_perm('leads.assign')) or (select has_perm('roles.manage')));
create policy p_delete on public.main_5_lead_database for delete to authenticated
  using ((select has_perm('roles.manage')));

-- เซลเห็นเฉพาะดีลที่ตัวเองถือ · ลีดที่ยังไม่มีคนถือเห็นได้เฉพาะคนที่มี leads.view_all
-- (ซึ่งเป็นคนกลุ่มเดียวกับที่มี leads.assign จึงมอบหมายต่อได้)
create policy p_select on public.main_6_buyer_crm for select to authenticated
  using ((select has_perm('leads.view_all'))
         or ((select has_perm('leads.view_own')) and sale_id = (select current_employee_code())));
create policy p_insert on public.main_6_buyer_crm for insert to authenticated
  with check (((select has_perm('leads.create')) or (select has_perm('roles.manage')))
              and (sale_id = (select current_employee_code())
                   or sale_id is null
                   or (select has_perm('leads.assign'))));
-- with check กันเซลโยนดีลออกจากมือตัวเอง เว้นแต่มี leads.assign ซึ่งหน้าที่คือมอบหมายต่อ
create policy p_update on public.main_6_buyer_crm for update to authenticated
  using (((select has_perm('leads.edit')) or (select has_perm('leads.assign')) or (select has_perm('roles.manage')))
         and ((select has_perm('leads.view_all')) or sale_id = (select current_employee_code())))
  with check ((select has_perm('leads.assign')) or (select has_perm('leads.view_all'))
              or sale_id = (select current_employee_code()));
create policy p_delete on public.main_6_buyer_crm for delete to authenticated
  using ((select has_perm('roles.manage')));

-- ดีลที่ปิดได้: own / team / all ครบสามชั้น
create policy p_select on public.main_7_last_match for select to authenticated
  using ((select has_perm('lastmatch.view_all'))
         or ((select has_perm('lastmatch.view_team')) and sale_id in (select visible_employee_codes()))
         or ((select has_perm('lastmatch.view_own'))  and sale_id = (select current_employee_code())));
create policy p_insert on public.main_7_last_match for insert to authenticated
  with check ((select has_perm('lastmatch.add'))
              and (sale_id = (select current_employee_code())
                   or (select has_perm('lastmatch.view_all'))
                   or (select has_perm('lastmatch.view_team'))));
create policy p_update on public.main_7_last_match for update to authenticated
  using      ((select has_perm('roles.manage'))
              or ((select has_perm('lastmatch.add')) and sale_id = (select current_employee_code()))
              or ((select has_perm('lastmatch.view_all')) and (select has_perm('lastmatch.add'))))
  with check ((select has_perm('roles.manage'))
              or ((select has_perm('lastmatch.add')) and sale_id = (select current_employee_code()))
              or ((select has_perm('lastmatch.view_all')) and (select has_perm('lastmatch.add'))));
create policy p_delete on public.main_7_last_match for delete to authenticated
  using ((select has_perm('roles.manage')));

create policy p_select on public.contacts for select to authenticated
  using ((select has_perm('contacts.view_all'))
         or ((select has_perm('contacts.view_own'))
             and (created_by = (select current_employee_code())
                  or assigned_to = (select current_employee_code()))));
create policy p_insert on public.contacts for insert to authenticated
  with check ((select has_perm('contacts.manage')) or (select has_perm('roles.manage')));
create policy p_update on public.contacts for update to authenticated
  using      (((select has_perm('contacts.manage')) or (select has_perm('roles.manage')))
              and ((select has_perm('contacts.view_all'))
                   or created_by = (select current_employee_code())
                   or assigned_to = (select current_employee_code())))
  with check ((select has_perm('contacts.manage')) or (select has_perm('roles.manage')));
create policy p_delete on public.contacts for delete to authenticated
  using ((select has_perm('roles.manage')));

-- contact_roles เกาะตาม contact แม่ — subquery โดน RLS ของ contacts ทับอีกชั้นเอง
create policy p_select on public.contact_roles for select to authenticated
  using (exists (select 1 from public.contacts c where c.id = contact_id));
create policy p_insert on public.contact_roles for insert to authenticated
  with check (((select has_perm('contacts.manage')) or (select has_perm('roles.manage')))
              and exists (select 1 from public.contacts c where c.id = contact_id));
create policy p_update on public.contact_roles for update to authenticated
  using      (((select has_perm('contacts.manage')) or (select has_perm('roles.manage')))
              and exists (select 1 from public.contacts c where c.id = contact_id))
  with check ((select has_perm('contacts.manage')) or (select has_perm('roles.manage')));
create policy p_delete on public.contact_roles for delete to authenticated
  using (((select has_perm('contacts.manage')) or (select has_perm('roles.manage')))
         and exists (select 1 from public.contacts c where c.id = contact_id));;
