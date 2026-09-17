-- ============================================================
-- เปลี่ยนหลักคิดการมอบหมาย (Ben, 2026-08-03)
--
-- เดิม: โซนเป็นตัวตัดสินว่าใครดูแล -> 1 โซนมีได้เซลเดียว
-- ใหม่: "ทรัพย์" เป็นตัวตัดสิน (main_4.sale_id = เซลที่ดูแลบ้านหลังนั้น)
--       ลีดวิ่งตามรหัสทรัพย์ที่ลูกค้าสนใจ ไม่ใช่ตามโซน
--       โซนเลยมีหลายเซลได้ โดยไม่กำกวมอีกต่อไป
--
-- โซนยังจำเป็นเป็น "ตัวสำรอง" 2 กรณี: ลีดที่ไม่ระบุทรัพย์ และทรัพย์ใหม่ที่ยังไม่ระบุเซล
-- จึงเก็บธง is_primary ไว้ตอบว่าใครรับผิดชอบโซนนั้นเป็นหลัก
-- ============================================================

-- ---- 1) ผู้ดูแลทรัพย์ = ตัวจริงของการมอบหมาย ----
alter table main_4_listing_database
  add column if not exists sale_id text references main_1_hr (employee_code) on update cascade on delete set null;

comment on column main_4_listing_database.sale_id is
  'เซลที่ดูแลทรัพย์หลังนี้ — ตัวตัดสินว่าลีดที่สนใจทรัพย์นี้ไปหาใคร. ต่างจาก created_by (uuid) ที่บอกแค่ใครสร้างแถว';

create index if not exists idx_listing_sale on main_4_listing_database (sale_id);

-- ---- 2) โซน: 1 โซนมีได้หลายเซล ----
create table if not exists zone_sales (
  zone_id       text not null references zone (zone_id)              on update cascade on delete cascade,
  employee_code text not null references main_1_hr (employee_code)   on update cascade on delete cascade,
  is_primary    boolean not null default false,
  created_at    timestamptz default now(),
  primary key (zone_id, employee_code)
);
-- โซนหนึ่งมี "คนหลัก" ได้ไม่เกิน 1 คน (ใช้ตอนต้องเดาว่าลีดควรไปหาใคร)
create unique index if not exists uq_zone_primary on zone_sales (zone_id) where is_primary;
create index if not exists idx_zone_sales_emp on zone_sales (employee_code);

comment on table zone_sales is
  'เซลคนไหนดูแลโซนไหนบ้าง (many-to-many). is_primary = เจ้าภาพโซน ใช้เป็นค่าสำรองเมื่อทรัพย์/ลีดไม่ระบุเซล';

-- ย้ายข้อมูลเดิมจากคอลัมน์เดี่ยว -> ตารางใหม่ (คนเดิมกลายเป็นคนหลัก)
insert into zone_sales (zone_id, employee_code, is_primary)
  select zone_id, sale_id_assigned, true from zone where sale_id_assigned is not null
on conflict do nothing;

-- ---- 3) helper: เจ้าภาพโซน (ใช้เป็นค่าสำรอง) ----
create or replace function zone_primary_sale(p_zone text)
returns text language sql stable as $$
  select employee_code from zone_sales where zone_id = p_zone and is_primary limit 1
$$;

comment on function zone_primary_sale(text) is
  'เซลเจ้าภาพของโซน — ใช้เฉพาะตอนทรัพย์ยังไม่ระบุ sale_id';

-- ---- 4) trigger A-List: เอา sale_id ของทรัพย์ก่อน ค่อย fallback ไปเจ้าภาพโซน ----
create or replace function sync_potential_listing()
returns trigger language plpgsql as $$
declare
  v_tier      boolean := new.potential in ('A List','A List + Fb add','Exclusive','Exclusive A');
  v_exists    boolean;
  v_sale      text;
  v_proj_thai text;
begin
  select exists(select 1 from main_10_potential_listing where listing_id = new.listing_id) into v_exists;

  if v_tier then
    -- ผู้ดูแลทรัพย์คือตัวจริง; ถ้ายังไม่ระบุค่อยใช้เจ้าภาพโซน
    v_sale := coalesce(new.sale_id, zone_primary_sale(new.zone));
    select project_name_thai into v_proj_thai from main_3_property_detail where project_id = new.project_id;

    insert into main_10_potential_listing (
      listing_id, date_a_list, potential, project_name_thai, unit_condition, price, sale_id,
      ddproperty_link, livinginsider_link, propertyhub_link
    ) values (
      new.listing_id, current_date, new.potential, v_proj_thai, new.unit_condition,
      new.asking_price, v_sale,
      new.ddproperty_link, new.livinginsider_link, new.propertyhub_link
    )
    on conflict (listing_id) do update set
      potential          = excluded.potential,
      project_name_thai  = excluded.project_name_thai,
      unit_condition     = excluded.unit_condition,
      price              = excluded.price,
      sale_id            = excluded.sale_id,
      ddproperty_link    = excluded.ddproperty_link,
      livinginsider_link = excluded.livinginsider_link,
      propertyhub_link   = excluded.propertyhub_link,
      updated_at         = now();

    if not v_exists then
      insert into main_11_potential_listing_log (listing_id, potential, action, sale_id, date_a_list)
      values (new.listing_id, new.potential, 'added', v_sale, current_date);
    end if;
  else
    if v_exists then
      delete from main_10_potential_listing where listing_id = new.listing_id;
      insert into main_11_potential_listing_log (listing_id, potential, action, sale_id, date_a_list)
      values (new.listing_id, new.potential, 'removed',
              coalesce(new.sale_id, zone_primary_sale(new.zone)), current_date);
    end if;
  end if;
  return new;
end; $$;

alter table zone_sales enable row level security;
drop policy if exists demo_read_all on zone_sales;
create policy demo_read_all on zone_sales for select to anon, authenticated using (true);;
