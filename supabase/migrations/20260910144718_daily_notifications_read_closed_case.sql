-- Section 3 of the nightly run (ดีลปิดแล้วแต่ข้อมูลไม่ครบ) now reads closed_case, not the
-- lead's retired closing columns. Same rule as lib/deals.ts caseGaps(): a pending case is
-- short its signing facts, a successful one also its transfer facts, a failed one is over.
-- Sections 1, 2 and 4 are unchanged.
CREATE OR REPLACE FUNCTION public.run_daily_notifications()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  stale_days   int  := 7;   -- ลีดไม่ได้ติดตามกี่วันถึงนับว่าค้าง
  started      date;
  sent         int  := 0;
  r            record;
begin
  select started_at into started from notification_cron_state where id;

  -- ── 1. ลีดค้าง → เตือนเจ้าของลีด ─────────────────────────────────────────
  for r in
    select c.sale_id as who, count(*) as n
    from main_6_buyer_crm c
    join main_1_hr h on h.employee_code = c.sale_id and coalesce(h.status,'') ilike 'active%'
    where c.sale_id is not null
      and coalesce(c.pipeline_stage,'') not in ('Win','Close')
      -- นาฬิกาเริ่มที่วันเปิดระบบ ไม่ใช่วันติดตามล่าสุดจากชีท
      and greatest(coalesce(c.last_follow_date, date '1900-01-01'), started) < current_date - stale_days
    group by c.sale_id
  loop
    -- กันยิงซ้ำถ้า cron รันสองรอบในวันเดียว
    if not exists (
      select 1 from notifications
      where employee_code = r.who and type = 'lead_stale' and created_at::date = current_date
    ) then
      insert into notifications(employee_code, type, title, body, entity, actor)
      values (r.who, 'lead_stale',
              'ลีดที่ควรติดตาม ' || r.n || ' ราย',
              'ไม่ได้บันทึกการติดตามเกิน ' || stale_days || ' วัน',
              'lead', 'ระบบ');
      sent := sent + 1;
    end if;
  end loop;

  -- ── 2. ใบลารออนุมัติ → เตือนคนที่อนุมัติได้ ──────────────────────────────
  if exists (select 1 from leave_requests where status = 'pending') then
    for r in
      select ur.employee_code as who,
             (select count(*) from leave_requests where status = 'pending') as n
      from user_roles ur
      join role_permissions rp on rp.role_id = ur.role_id and rp.permission_key = 'leave.manage'
      join main_1_hr h on h.employee_code = ur.employee_code
                      and coalesce(h.status,'') ilike 'active%'
      group by ur.employee_code
    loop
      if not exists (
        select 1 from notifications
        where employee_code = r.who and type = 'leave_pending' and created_at::date = current_date
      ) then
        insert into notifications(employee_code, type, title, body, entity, actor)
        values (r.who, 'leave_pending',
                'ใบลารออนุมัติ ' || r.n || ' ใบ', null, 'task', 'ระบบ');
        sent := sent + 1;
      end if;
    end loop;
  end if;

  -- ── 3. เคสที่ยังกรอกตัวเลขไม่ครบ → เตือนคนที่ได้เครดิต ──────────────────
  -- อ่านจาก closed_case (ตั้งแต่ 2026-09-10) — ไม่ใช่คอลัมน์เก่าบนลีดอีกต่อไป
  --   pending  ขาด วันที่ปิด / ราคาปิด / คอมที่คาด
  --   success  ขาดข้างบน หรือ วันที่โอน / ยอดที่ได้รับจริง
  --   fail     ไม่เตือน — ดีลจบแล้ว
  for r in
    select a.employee_code as who, count(distinct c.case_id) as n
    from closed_case c
    join closed_case_agent a on a.case_id = c.case_id
    join main_1_hr h on h.employee_code = a.employee_code and coalesce(h.status,'') ilike 'active%'
    where c.status <> 'fail'
      and (
        c.closing_date is null
        or c.closing_price is null
        or c.forecast_revenue is null
        or (c.status = 'success' and (c.transfer_date is null or c.real_revenue is null))
      )
    group by a.employee_code
  loop
    if not exists (
      select 1 from notifications
      where employee_code = r.who and type = 'deal_missing_price' and created_at::date = current_date
    ) then
      insert into notifications(employee_code, type, title, body, entity, actor)
      values (r.who, 'deal_missing_price',
              'ดีลที่ปิดแล้วแต่ข้อมูลไม่ครบ ' || r.n || ' ดีล',
              'ขาดราคาปิด วันที่ปิด คอมมิชชั่น หรือยอดที่ได้รับจริง — กรอกได้ที่หน้า Lead',
              'lead', 'ระบบ');
      sent := sent + 1;
    end if;
  end loop;

  -- ── 4. ทรัพย์ที่ประกาศอยู่แต่ยังไม่มีรูป → เตือนเซลที่ดูแล ────────────────
  -- เฉพาะสถานะที่ยัง "มีชีวิต" — Sold/Cancel Completed ไม่ต้องตามรูปแล้ว
  for r in
    select coalesce(l.sale_id, zone_primary_sale(l.zone)) as who, count(*) as n
    from main_4_listing_database l
    where coalesce(l.listing_status,'') in ('Posted','Ready to Post','Update')
      and not exists (select 1 from main_8_listing_photo p where p.listing_id = l.listing_id)
    group by 1
  loop
    if r.who is not null
       and exists (select 1 from main_1_hr where employee_code = r.who
                   and coalesce(status,'') ilike 'active%')
       and not exists (
         select 1 from notifications
         where employee_code = r.who and type = 'listing_no_photo' and created_at::date = current_date
       )
    then
      insert into notifications(employee_code, type, title, body, entity, actor)
      values (r.who, 'listing_no_photo',
              'ทรัพย์ที่ยังไม่มีรูป ' || r.n || ' รายการ',
              'ทรัพย์ที่ประกาศอยู่ควรมีรูปจริง', 'listing', 'ระบบ');
      sent := sent + 1;
    end if;
  end loop;

  update notification_cron_state set last_run_at = now() where id;
  return sent;
end;
$function$;;
