-- Phase 4 RLS step 4/5 — งานประจำวัน / ผลงาน / ใบลา / audit
do $do$
declare t text;
begin
  foreach t in array array['activities','tasks','user_quick_actions','notifications',
                           'targets','leave_requests','audit_log'] loop
    execute format('drop policy if exists p_select on public.%I', t);
    execute format('drop policy if exists p_insert on public.%I', t);
    execute format('drop policy if exists p_update on public.%I', t);
    execute format('drop policy if exists p_delete on public.%I', t);
  end loop;
end
$do$;

-- กิจกรรม (ฐานของแดชบอร์ดผลงาน) — ของตัวเอง + หัวหน้าเห็นลูกทีม
create policy p_select on public.activities for select to authenticated
  using (employee_code = (select current_employee_code())
         or ((select has_perm('performance.view_team')) and employee_code in (select visible_employee_codes())));
create policy p_insert on public.activities for insert to authenticated
  with check ((select has_perm('roles.manage'))
              or ((select has_perm('activity.log')) and employee_code = (select current_employee_code())));
create policy p_update on public.activities for update to authenticated
  using      ((select has_perm('roles.manage')) or employee_code = (select current_employee_code()))
  with check ((select has_perm('roles.manage')) or employee_code = (select current_employee_code()));
create policy p_delete on public.activities for delete to authenticated
  using ((select has_perm('roles.manage')) or employee_code = (select current_employee_code()));

-- แผนงานวันนี้ / ปุ่มลัดส่วนตัว / แจ้งเตือน — ส่วนตัวล้วน
do $do$
declare t text;
begin
  foreach t in array array['tasks','user_quick_actions','notifications'] loop
    execute format($f$create policy p_select on public.%I for select to authenticated
      using (employee_code = (select current_employee_code()) or (select has_perm('roles.manage')))$f$, t);
    execute format($f$create policy p_insert on public.%I for insert to authenticated
      with check (employee_code = (select current_employee_code()) or (select has_perm('roles.manage')))$f$, t);
    execute format($f$create policy p_update on public.%I for update to authenticated
      using      (employee_code = (select current_employee_code()) or (select has_perm('roles.manage')))
      with check (employee_code = (select current_employee_code()) or (select has_perm('roles.manage')))$f$, t);
    execute format($f$create policy p_delete on public.%I for delete to authenticated
      using (employee_code = (select current_employee_code()) or (select has_perm('roles.manage')))$f$, t);
  end loop;
end
$do$;

-- เป้าหมาย/KPI: ตัวเองตั้งเป้าเสริมได้ (targets.stretch) · หัวหน้าตั้งให้ลูกทีม (targets.set)
create policy p_select on public.targets for select to authenticated
  using (employee_code = (select current_employee_code())
         or ((select has_perm('performance.view_team')) and employee_code in (select visible_employee_codes())));
create policy p_insert on public.targets for insert to authenticated
  with check ((select has_perm('roles.manage'))
              or ((select has_perm('targets.stretch')) and employee_code = (select current_employee_code()))
              or ((select has_perm('targets.set'))     and employee_code in (select visible_employee_codes())));
create policy p_update on public.targets for update to authenticated
  using      ((select has_perm('roles.manage'))
              or ((select has_perm('targets.stretch')) and employee_code = (select current_employee_code()))
              or ((select has_perm('targets.set'))     and employee_code in (select visible_employee_codes())))
  with check ((select has_perm('roles.manage'))
              or ((select has_perm('targets.stretch')) and employee_code = (select current_employee_code()))
              or ((select has_perm('targets.set'))     and employee_code in (select visible_employee_codes())));
create policy p_delete on public.targets for delete to authenticated
  using ((select has_perm('roles.manage'))
         or ((select has_perm('targets.stretch')) and employee_code = (select current_employee_code()))
         or ((select has_perm('targets.set'))     and employee_code in (select visible_employee_codes())));

-- ใบลา: เห็นของตัวเอง · HR/CEO เห็นหมดและอนุมัติได้
create policy p_select on public.leave_requests for select to authenticated
  using (employee_code = (select current_employee_code())
         or (select has_perm('leave.manage')) or (select has_perm('roles.manage')));
create policy p_insert on public.leave_requests for insert to authenticated
  with check ((select has_perm('leave.manage')) or (select has_perm('roles.manage'))
              or ((select has_perm('leave.request')) and employee_code = (select current_employee_code())));
create policy p_update on public.leave_requests for update to authenticated
  using      ((select has_perm('leave.manage')) or (select has_perm('roles.manage'))
              or employee_code = (select current_employee_code()))
  with check ((select has_perm('leave.manage')) or (select has_perm('roles.manage'))
              or employee_code = (select current_employee_code()));
create policy p_delete on public.leave_requests for delete to authenticated
  using ((select has_perm('leave.manage')) or (select has_perm('roles.manage'))
         or employee_code = (select current_employee_code()));

-- audit_log: เขียนได้ในนามตัวเองเท่านั้น · ไม่มี update/delete โดยตั้งใจ = ลบร่องรอยตัวเองไม่ได้
create policy p_select on public.audit_log for select to authenticated
  using ((select has_perm('roles.manage')));
create policy p_insert on public.audit_log for insert to authenticated
  with check (changed_by = (select current_employee_code()) or (select has_perm('roles.manage')));;
