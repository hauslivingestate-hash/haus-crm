drop view if exists v_support_listing;
drop view if exists v_main_listing;

-- ---- 1) แก้ชนิดคอลัมน์ให้ตรงกับชีท: boost/repost เป็น TRUE/FALSE ไม่ใช่วันที่ ----
alter table main_4_listing_database
  drop column if exists dd_boost,
  drop column if exists lv_boost,
  drop column if exists fb_repost;
alter table main_4_listing_database
  add column dd_boost  boolean,
  add column lv_boost  boolean,
  add column fb_repost boolean,
  add column buyer_persona text;
comment on column main_4_listing_database.buyer_persona is 'กลุ่มลูกค้าเป้าหมายของทรัพย์ (ชีทคอลัมน์ Buyer Persona) — ใช้เติม hook ด้วย';

create view v_main_listing
with (security_invoker = true) as
select l.*,
  p.project_name_thai as listing_name,
  p.project_name_eng  as project_name_eng,
  z.name_thai as zone_name_thai,
  z.name_eng  as zone_name_eng,
  o.owner_name, o.owner_phone, o.owner_line,
  coalesce(l.sale_id, zone_primary_sale(l.zone)) as effective_sale_id,
  case when l.livinginsider_date is not null
       then (current_date - l.livinginsider_date) end as days_on_market
from main_4_listing_database l
left join main_3_property_detail p on p.project_id = l.project_id
left join main_2_owner o on o.owner_id = l.owner_id
left join zone       z on z.zone_id  = l.zone;

create view v_support_listing
with (security_invoker = true) as
select * from v_main_listing
where listing_status in ('Ready to Post', 'Cancel', 'Update', 'Sold');

grant select on v_main_listing, v_support_listing to anon, authenticated;

-- ---- 2) โซนใหม่ที่เจอในชีททรัพย์ ----
insert into zone (zone_id, name_eng, name_thai) values ('PKD','Pak-kred','ปากเกร็ด')
on conflict (zone_id) do nothing;

-- ---- 3) กิจกรรมที่ Ben อนุมัติให้เพิ่ม ----
insert into action_type (name, group_label, attach, sort_order) values
  ('Owner Talk','งานทรัพย์','listing',28),
  ('Update Price','งานทรัพย์','listing',29),
  ('เซ็นสัญญา','ไปป์ไลน์ (ลูกค้า)','lead',17)
on conflict (name) do nothing;

-- ---- 4) สิทธิ์เขียน: เฉพาะคนที่ถือ roles.manage (ตอนนี้คือบัญชี Admin) ----
-- ไม่ใช่ policy ชั่วคราว — ผู้ดูแลระบบควรเขียนได้อยู่แล้ว role อื่นค่อยเปิดตอน Phase 4
do $$
declare t text;
begin
  foreach t in array array[
    'main_2_owner','main_3_property_detail','main_4_listing_database',
    'main_5_lead_database','main_6_buyer_crm','main_7_last_match',
    'main_9_support_log','main_10_potential_listing','main_11_potential_listing_log',
    'activities','zone'
  ]
  loop
    execute format('drop policy if exists admin_write on %I', t);
    execute format(
      'create policy admin_write on %I for all to authenticated using (has_perm(''roles.manage'')) with check (has_perm(''roles.manage''))', t);
  end loop;
end $$;;
