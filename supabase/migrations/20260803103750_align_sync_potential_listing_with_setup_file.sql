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
      -- ไม่แตะ date_a_list และคอลัมน์ที่ Support กรอกเอง

    if not v_exists then
      insert into main_11_potential_listing_log (listing_id, potential, action, sale_id, date_a_list)
        values (new.listing_id, new.potential, 'added', v_sale, current_date);
    end if;

  else
    -- หลุดเกณฑ์: ถ้ามีอยู่ -> log 'removed' แล้วลบออก (เอา sale_id/วันที่เดิมไปเก็บ ไม่ใช่ค่าปัจจุบัน)
    if v_exists then
      insert into main_11_potential_listing_log (listing_id, potential, action, sale_id, date_a_list)
        select p.listing_id, new.potential, 'removed', p.sale_id, p.date_a_list
        from main_10_potential_listing p where p.listing_id = new.listing_id;
      delete from main_10_potential_listing where listing_id = new.listing_id;
    end if;
  end if;

  return new;
end; $$;;
