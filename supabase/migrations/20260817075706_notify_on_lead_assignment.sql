-- แจ้งเตือนตอนมอบหมายลีด (Ben, 2026-08-17 — เลือกทาง trigger ไม่ใช่ RPC)
--
-- ปัญหา: policy INSERT ของ `notifications` เป็น own-row (หรือ roles.manage) → คนที่มอบลีด
-- ให้คนอื่นเขียนแจ้งเตือนถึงคนนั้นไม่ได้ ซึ่งเป็นจุดประสงค์ทั้งหมดของแจ้งเตือนตัวนี้
-- ตอนนี้มอบหมายได้ 3 คน: Stone (ceo) · Admin (system_admin) ผ่านอยู่แล้วเพราะมี roles.manage ·
-- **Benz (listing_support) คือคนเดียวที่ติด** และเป็นคนที่ทำงานนี้จริง
--
-- ทำไมเลือก trigger แทน RPC:
--   1) ลีดของบริษัทนี้เข้าทาง n8n เป็นหลัก (952/953 มี sale_id มาแล้วตั้งแต่ต้นทาง)
--      RPC จะครอบเฉพาะตอนคนกดปุ่มในเว็บ → เงียบสนิทตอนที่ควรดังที่สุด
--   2) ไม่ต้องขยายสิทธิ์ให้ใครเลย — สวนทางกับที่ Ben กำลังจำกัดสิทธิ์ให้แคบลง
--   3) ปลอมไม่ได้ ข้อความระบบเขียนเอง ไม่รับจากผู้ใช้
--
-- ⚠️ ถ้าจะ IMPORT ลีดเป็นก้อนอีกครั้ง ให้ปิด trigger ก่อน ไม่งั้นจะยิงแจ้งเตือนพันกว่าใบ:
--     alter table main_6_buyer_crm disable trigger trg_notify_lead_assigned;
--     ... import ...
--     alter table main_6_buyer_crm enable trigger trg_notify_lead_assigned;

create or replace function public.notify_lead_assigned()
returns trigger
language plpgsql
-- security definer เพราะต้องเขียนแถวที่ "ผู้รับ ≠ คนที่ทำ" ซึ่ง RLS ปฏิเสธโดยตั้งใจ
-- เจ้าของฟังก์ชันคือ postgres (bypass RLS ได้เพราะตารางไม่ได้ force rls)
security definer
-- ตรึง search_path ตาม advisor 0011 เหมือน trigger function ตัวอื่นในโปรเจกต์
set search_path = public
as $$
declare
  actor_code text;
  actor_name text;
  lead_label text;
begin
  -- WHEN ของ trigger อ้าง OLD ไม่ได้เมื่อเป็น INSERT จึงเช็คตรงนี้แทน:
  -- อัปเดตที่แตะ sale_id แต่ค่าเท่าเดิม = ไม่ได้ย้ายมือ ไม่ต้องเตือน
  if tg_op = 'UPDATE' and new.sale_id is not distinct from old.sale_id then
    return new;
  end if;

  -- ไม่ต้องเตือนตัวเอง: เซลที่กดรับลีดของตัวเองรู้อยู่แล้ว
  actor_code := current_employee_code();
  if new.sale_id = actor_code then
    return new;
  end if;

  -- ผู้รับต้องเป็นพนักงานที่ยังทำงานอยู่ (FK ไม่ได้เช็คสถานะให้)
  if not exists (
    select 1 from main_1_hr
    where employee_code = new.sale_id and coalesce(status,'') ilike 'active%'
  ) then
    return new;
  end if;

  -- ใครเป็นคนมอบ — null เมื่อมาจาก n8n / service role (ไม่มี session)
  select nickname into actor_name from main_1_hr where employee_code = actor_code;

  lead_label := coalesce(nullif(trim(new.lead_name), ''), new.lead_id);

  insert into notifications(employee_code, type, title, body, entity, entity_id, actor)
  values (
    new.sale_id,
    'lead_assigned',
    'ได้รับ Lead ใหม่: ' || lead_label,
    case when new.phone is not null then 'เบอร์ ' || new.phone else null end,
    'lead',
    new.lead_id,
    coalesce(actor_name, 'ระบบ')
  );

  return new;
end;
$$;

revoke execute on function public.notify_lead_assigned() from public, anon;

drop trigger if exists trg_notify_lead_assigned on public.main_6_buyer_crm;

-- ยิงทั้งตอนสร้างลีดที่ระบุเซลมาแล้ว (เคสของ n8n) และตอนย้ายมือ
create trigger trg_notify_lead_assigned
after insert or update of sale_id on public.main_6_buyer_crm
for each row
when (new.sale_id is not null)
execute function public.notify_lead_assigned();;
