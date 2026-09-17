-- แจ้งเตือน "ดีลปิดแล้วแต่กรอกข้อมูลไม่ครบ" — pointed at the right table.
--
-- ⚠️ WHAT WAS WRONG. Block 3 counted rows in `main_7_last_match` with a null
-- `last_match_price` and told the sale to go fill them in. That table is a MARKET
-- LOG: only 16 of its 56 rows are this company's deals, the rest are other agencies'
-- sales recorded for comparison. Sales were being asked, every day, to supply closing
-- prices for deals they did not make and could not know. A reminder that cannot be
-- acted on is a reminder people learn to dismiss, and it takes the other three with it.
--
-- WHAT IT DOES NOW. Counts CLOSED deals on `main_6_buyer_crm` that are missing any of
-- the three facts only the sale can supply — ราคาปิด, วันที่ปิด, คอมมิชชั่น.
--
-- "Closed" is NOT `pipeline_stage = 'Win'`. Four completed deals sit at Lead/Show/
-- Appoint because nobody updated the dropdown, and the three that most need this
-- reminder are exactly the ones whose stage is stale. Any of five independent facts
-- counts — including the LISTING saying Sold Completed while the lead says nothing,
-- which is what catches L26-189, L26-322 and L26-337 today. Mirrors `isClosed` and
-- `dealGaps` in lib/deals.ts; the two must change together.
--
-- transfer_date is deliberately NOT required. Signed-but-not-yet-transferred is the
-- normal state of a healthy deal — nagging about it would fire on every live sale.

create or replace function public.run_daily_notifications()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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

  -- ── 3. ดีลปิดแล้วแต่ข้อมูลไม่ครบ → เตือนเจ้าของดีล ───────────────────────
  -- ตัวเลขพวกนี้เป็นที่เดียวที่ระบบเก็บยอดขาย มีแต่เซลที่ปิดดีลเท่านั้นที่รู้
  for r in
    select c.sale_id as who, count(*) as n
    from main_6_buyer_crm c
    join main_1_hr h on h.employee_code = c.sale_id and coalesce(h.status,'') ilike 'active%'
    left join main_4_listing_database l on l.listing_id = c.listing_code
    where c.sale_id is not null
      -- ปิดแล้ว (ห้ามดูแค่ stage — stage ค้างบ่อย)
      and (
        coalesce(c.pipeline_stage,'') in ('Win','Close')
        or c.commission is not null
        or c.closing_price is not null
        or c.closing_date is not null
        or c.transfer_date is not null
        or coalesce(l.listing_status,'') = 'Sold Completed'
      )
      -- แต่ยังขาดอย่างน้อยหนึ่งอย่าง
      and (
        c.closing_date is null
        or c.closing_price is null
        or c.commission is null
      )
    group by c.sale_id
  loop
    if not exists (
      select 1 from notifications
      where employee_code = r.who and type = 'deal_missing_price' and created_at::date = current_date
    ) then
      insert into notifications(employee_code, type, title, body, entity, actor)
      values (r.who, 'deal_missing_price',
              'ดีลที่ปิดแล้วแต่ข้อมูลไม่ครบ ' || r.n || ' ดีล',
              'ขาดราคาปิด วันที่ปิด หรือคอมมิชชั่น — กรอกได้ที่หน้า Lead',
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
$function$;
;
