-- 4 ชนิดใหม่สำหรับแจ้งเตือนตามเวลา (daily_reminder_notifications)
-- ⚠️ `notifications.type` มี check constraint อยู่ — เพิ่มชนิดใหม่ต้องแก้ constraint ด้วย
-- ไม่ใช่แค่เพิ่มใน union ฝั่ง TypeScript (เจอตอนรันฟังก์ชันครั้งแรก)
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (
  type = any (array[
    'lead_assigned',
    'lead_stage_changed',
    'deal_won',
    'task_due',
    'target_milestone',
    'listing_new_in_zone',
    'listing_price_changed',
    -- ตัวเตือนรายวัน — ทุกตัวเป็นใบสรุปวันละใบต่อคน
    'lead_stale',
    'leave_pending',
    'deal_missing_price',
    'listing_no_photo'
  ])
);;
