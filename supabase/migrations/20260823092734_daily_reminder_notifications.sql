-- แจ้งเตือนตามเวลา (Ben, 2026-08-23) — งานที่ไม่มีใคร "กด" อะไรตอนที่มันควรเตือน
--
-- ใช้ pg_cron ในตัว Supabase: ไม่ต้องมีเซิร์ฟเวอร์แยก ไม่ต้องตั้ง Vercel cron ไม่มีค่าใช้จ่ายเพิ่ม
--
-- ⚠️ ทุกกฎเป็น "ใบสรุปวันละใบต่อคน" ไม่ใช่ใบต่อรายการ (Ben เลือก) เพราะลีดที่ค้างอยู่ตอนนี้มี
-- ~925 ราย ถ้ายิงใบต่อลีด วันแรกกระดิ่งจะกลายเป็นขยะและไม่มีใครเปิดดูอีกเลย
--
-- ⚠️ นาฬิกาลีดค้าง "เริ่มนับตอนเปิดระบบ" (Ben เลือก) — ช่อง last_follow_date มาจากชีทตอน
-- import แล้วยังไม่มีใครใช้ในเว็บ ลีด 337 รายไม่เคยมีวันติดตามเลย จึงใช้
-- greatest(last_follow_date, started_at) → วันเปิดระบบได้ 0 ใบ แล้วค่อยเริ่มเตือนหลังพ้น
-- ระยะผ่อนผัน ซึ่งตอนนั้นมันค้างจริงแล้ว

create extension if not exists pg_cron;

-- เก็บวันที่เริ่มใช้ระบบแจ้งเตือน — เป็นจุดตั้งต้นของนาฬิกา "ลีดค้าง"
create table if not exists notification_cron_state (
  id          boolean primary key default true check (id),
  started_at  date not null default current_date,
  last_run_at timestamptz
);
insert into notification_cron_state (id) values (true) on conflict (id) do nothing;

alter table notification_cron_state enable row level security;
revoke all on notification_cron_state from anon;
grant select on notification_cron_state to authenticated;
drop policy if exists p_select on notification_cron_state;
create policy p_select on notification_cron_state for select to authenticated using (true);

create or replace function public.run_daily_notifications()
returns integer
language plpgsql
-- ต้องเป็น security definer: เขียนแจ้งเตือนถึงคนอื่น ซึ่ง policy own-row ปฏิเสธโดยตั้งใจ
security definer
set search_path = public
as $$
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

  -- ── 3. ดีลปิดแล้วยังไม่กรอกราคา → เตือนเจ้าของดีล ───────────────────────
  -- ตัวเลขนี้เป็นที่เดียวที่ระบบเก็บยอดขาย และเป็นเหตุผลเดียวที่แดชบอร์ดยังเปิดไม่ได้
  for r in
    select m.sale_id as who, count(*) as n
    from main_7_last_match m
    join main_1_hr h on h.employee_code = m.sale_id and coalesce(h.status,'') ilike 'active%'
    where m.last_match_price is null
    group by m.sale_id
  loop
    if not exists (
      select 1 from notifications
      where employee_code = r.who and type = 'deal_missing_price' and created_at::date = current_date
    ) then
      insert into notifications(employee_code, type, title, body, entity, actor)
      values (r.who, 'deal_missing_price',
              'ดีลที่ยังไม่กรอกราคาปิด ' || r.n || ' ดีล',
              'กรอกได้ที่หน้า Last Match', 'target', 'ระบบ');
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
$$;

revoke execute on function public.run_daily_notifications() from public, anon, authenticated;

-- 02:00 UTC = 09:00 ไทย — เตือนตอนเช้าก่อนเริ่มงาน
select cron.unschedule('daily-notifications')
where exists (select 1 from cron.job where jobname = 'daily-notifications');

select cron.schedule(
  'daily-notifications',
  '0 2 * * *',
  $cron$ select public.run_daily_notifications() $cron$
);;
