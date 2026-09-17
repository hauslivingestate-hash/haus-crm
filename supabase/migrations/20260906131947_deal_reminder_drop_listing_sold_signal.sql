-- แก้บั๊กในบล็อก 3 — เอาสัญญาณ "ทรัพย์ขายแล้ว" ออก
--
-- ⚠️ THE BUG THIS FIXES, caught before it ever ran. The previous version treated a
-- linked listing marked `Sold Completed` as proof that THIS lead closed it. It is not.
-- A sold listing means SOMEONE bought the unit — and 188 leads point at the 52 listings
-- that have sold, because a dozen people viewing the same condo is what a viewing list
-- looks like. That turned 20 real deals into 205 and would have told C-001 they had 47
-- unfinished deals, about sales they never made. A daily notice that is wrong nine times
-- out of ten is a notice people mute, and it takes the other three blocks with it.
--
-- The three deals this reminder actually exists for — L26-189, L26-322, L26-337, each
-- carrying commission with no closing date — are caught by `commission is not null`
-- anyway. The listing signal contributed nothing but noise.
--
-- Writing the listing status when a deal closes is still correct and still happens, in
-- lib/mutations/deals.ts: this deal closing DOES mean the unit is sold, even though the
-- unit being sold does not mean this deal closed. The implication only runs one way.
--
-- Mirrors `isClosed` in lib/deals.ts. The two must change together.

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
  --
  -- "ปิดแล้ว" ไม่ได้ดูแค่ stage — stage ค้างบ่อย (4 ดีลที่จบแล้วยังเป็น Lead/Show/Appoint)
  -- แต่ก็ไม่ดูสถานะทรัพย์ด้วย — ทรัพย์ขายแล้วไม่ได้แปลว่า "ลีดนี้" เป็นคนซื้อ
  --
  -- ไม่บังคับวันที่โอน — เซ็นแล้วรอโอนเป็นเรื่องปกติของดีลที่กำลังเดิน
  for r in
    select c.sale_id as who, count(*) as n
    from main_6_buyer_crm c
    join main_1_hr h on h.employee_code = c.sale_id and coalesce(h.status,'') ilike 'active%'
    where c.sale_id is not null
      and (
        coalesce(c.pipeline_stage,'') in ('Win','Close')
        or c.commission is not null
        or c.closing_price is not null
        or c.closing_date is not null
        or c.transfer_date is not null
      )
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
