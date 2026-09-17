-- view ผูกรายชื่อคอลัมน์ตอนสร้าง — main_4 มี sale_id เพิ่ม จึงต้องสร้างใหม่
drop view if exists v_support_listing;
drop view if exists v_main_listing;

create view v_main_listing
with (security_invoker = true) as
select
  l.*,
  p.project_name_thai as listing_name,
  p.project_name_eng  as project_name_eng,
  z.name_thai as zone_name_thai,
  z.name_eng  as zone_name_eng,
  o.owner_name, o.owner_phone, o.owner_line,
  -- เซลที่รับผิดชอบจริง: ของทรัพย์ก่อน ถ้าไม่มีค่อยใช้เจ้าภาพโซน
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

-- ---- เซลคนไหนดูแลโซนไหน (อ่านจาก zone_sales แทนคอลัมน์เดี่ยว) ----
drop view if exists v_sale_zones;
create view v_sale_zones
with (security_invoker = true) as
select
  h.employee_code,
  h.nickname,
  count(zs.zone_id)                                as zone_count,
  string_agg(zs.zone_id,  ', ' order by zs.zone_id) as zone_ids,
  string_agg(z.name_thai, ', ' order by zs.zone_id) as zone_names,
  -- โซนที่เป็นเจ้าภาพ (ลีดที่ไม่ระบุทรัพย์จะวิ่งมาหาคนนี้)
  string_agg(zs.zone_id, ', ' order by zs.zone_id) filter (where zs.is_primary) as primary_zone_ids
from main_1_hr h
left join zone_sales zs on zs.employee_code = h.employee_code
left join zone       z  on z.zone_id = zs.zone_id
group by h.employee_code, h.nickname;

grant select on v_sale_zones to anon, authenticated;

-- ---- แดชบอร์ดผลงานเซล ----
-- เปลี่ยนวิธีนับทรัพย์: เดิมนับ "ทรัพย์ในโซนที่ดูแล" -> ตอนนี้นับ "ทรัพย์ที่ตัวเองดูแล"
-- (ถ้าทรัพย์ยังไม่ระบุ sale_id จะ fallback ไปเจ้าภาพโซน ยอดจึงไม่หายระหว่างรอ import)
drop view if exists v_sale_status;
create view v_sale_status
with (security_invoker = true) as
select
  h.employee_code,
  h.nickname,
  h.first_name_en,
  h.last_name_en,
  h.status as employee_status,
  (select string_agg(zs.zone_id, ', ' order by zs.zone_id)
     from zone_sales zs where zs.employee_code = h.employee_code)         as zones,

  (select count(*) from main_5_lead_database ld
     where ld.sales_id = h.employee_code)                                 as total_leads,

  (select count(*) from main_6_buyer_crm b
     where b.sale_id = h.employee_code)                                   as total_crm,
  (select count(*) from main_6_buyer_crm b
     where b.sale_id = h.employee_code and b.lead_status = 'Win')         as crm_win,
  (select count(*) from main_6_buyer_crm b
     where b.sale_id = h.employee_code and b.complete)                    as crm_complete,
  (select coalesce(sum(b.commission),0) from main_6_buyer_crm b
     where b.sale_id = h.employee_code)                                   as total_commission,

  (select count(*) from main_4_listing_database l
     where coalesce(l.sale_id, zone_primary_sale(l.zone)) = h.employee_code) as total_listings,

  (select count(*) from main_7_last_match m
     where m.sale_id = h.employee_code)                                   as total_matches,
  (select coalesce(sum(m.last_match_price),0) from main_7_last_match m
     where m.sale_id = h.employee_code)                                   as total_match_value,

  -- ==== Listing Potential ====
  (select count(*) from main_4_listing_database l
     where coalesce(l.sale_id, zone_primary_sale(l.zone))=h.employee_code and l.potential='Normal')          as lst_normal,
  (select count(*) from main_4_listing_database l
     where coalesce(l.sale_id, zone_primary_sale(l.zone))=h.employee_code and l.potential='A List')          as lst_a_list,
  (select count(*) from main_4_listing_database l
     where coalesce(l.sale_id, zone_primary_sale(l.zone))=h.employee_code and l.potential='A List + Fb add') as lst_a_list_fb,
  (select count(*) from main_4_listing_database l
     where coalesce(l.sale_id, zone_primary_sale(l.zone))=h.employee_code and l.potential='Exclusive')       as lst_exclusive,
  (select count(*) from main_4_listing_database l
     where coalesce(l.sale_id, zone_primary_sale(l.zone))=h.employee_code and l.potential='Exclusive A')     as lst_exclusive_a,

  -- ==== CRM Potential ====
  (select count(*) from main_6_buyer_crm b where b.sale_id=h.employee_code and b.potential='A')        as crm_a,
  (select count(*) from main_6_buyer_crm b where b.sale_id=h.employee_code and b.potential='B')        as crm_b,
  (select count(*) from main_6_buyer_crm b where b.sale_id=h.employee_code and b.potential='C')        as crm_c,
  (select count(*) from main_6_buyer_crm b where b.sale_id=h.employee_code and b.potential='New Lead') as crm_new_lead,
  (select count(*) from main_6_buyer_crm b where b.sale_id=h.employee_code and b.potential='Agent')    as crm_agent,

  -- ==== ลูกค้าที่เข้ามาผ่าน Listing ====
  (select count(*) from main_5_lead_database ld join main_4_listing_database l on l.listing_id=ld.listing_code
     where ld.sales_id=h.employee_code and l.potential='Normal')          as leadvia_normal,
  (select count(*) from main_5_lead_database ld join main_4_listing_database l on l.listing_id=ld.listing_code
     where ld.sales_id=h.employee_code and l.potential='A List')          as leadvia_a_list,
  (select count(*) from main_5_lead_database ld join main_4_listing_database l on l.listing_id=ld.listing_code
     where ld.sales_id=h.employee_code and l.potential='A List + Fb add') as leadvia_a_list_fb,
  (select count(*) from main_5_lead_database ld join main_4_listing_database l on l.listing_id=ld.listing_code
     where ld.sales_id=h.employee_code and l.potential='Exclusive')       as leadvia_exclusive,
  (select count(*) from main_5_lead_database ld join main_4_listing_database l on l.listing_id=ld.listing_code
     where ld.sales_id=h.employee_code and l.potential='Exclusive A')     as leadvia_exclusive_a
from main_1_hr h;

grant select on v_sale_status to anon, authenticated;

-- ตอนนี้ไม่มีอะไรอ้าง zone.sale_id_assigned แล้ว — ลบทิ้งกันข้อมูล 2 ที่ขัดกันเอง
alter table zone drop constraint if exists fk_zone_sale;
alter table zone drop column if exists sale_id_assigned;;
