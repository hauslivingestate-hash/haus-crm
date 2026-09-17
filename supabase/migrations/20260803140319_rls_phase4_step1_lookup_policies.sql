-- Phase 4 RLS step 1/5 — ตาราง lookup/อ้างอิง (ไม่แตะข้อมูล สร้าง policy อย่างเดียว)
-- policy ใหม่อยู่ร่วมกับ demo_read_all ได้ (permissive = OR กัน) แอปจึงไม่สะดุดระหว่างทาง
do $do$
declare
  t   text;
  grp record;
begin
  for grp in
    select * from (values
      (array['gender','nationality','potential','lead_status','pipeline_stage','bank_loan',
             'lead_type','complain_status','marketing_channel','contact_by','employee_status',
             'job_position','second_position','listing_status','listing_type','property_type',
             'in_out_project','direction','view_type','unit_position','price_remark',
             'unit_condition','close_type','listing_potential'],
       $q$ (select has_perm('reference.manage')) or (select has_perm('masterdata.govern')) or (select has_perm('roles.manage')) $q$),
      (array['action_type','lead_tags_ref','zone','zone_sales'],
       $q$ (select has_perm('masterdata.govern')) or (select has_perm('roles.manage')) $q$),
      (array['permissions','roles','role_permissions'],
       $q$ (select has_perm('roles.manage')) $q$),
      (array['leave_type','leave_allowances'],
       $q$ (select has_perm('leave.manage')) or (select has_perm('roles.manage')) $q$)
    ) as g(tables, write_expr)
  loop
    foreach t in array grp.tables loop
      execute format('drop policy if exists p_select on public.%I', t);
      execute format('drop policy if exists p_insert on public.%I', t);
      execute format('drop policy if exists p_update on public.%I', t);
      execute format('drop policy if exists p_delete on public.%I', t);
      execute format('create policy p_select on public.%I for select to authenticated using (true)', t);
      execute format('create policy p_insert on public.%I for insert to authenticated with check (%s)', t, grp.write_expr);
      execute format('create policy p_update on public.%I for update to authenticated using (%s) with check (%s)', t, grp.write_expr, grp.write_expr);
      execute format('create policy p_delete on public.%I for delete to authenticated using (%s)', t, grp.write_expr);
    end loop;
  end loop;
end
$do$;;
