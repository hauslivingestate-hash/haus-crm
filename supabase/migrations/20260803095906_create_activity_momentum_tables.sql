-- ============================================================
-- กิจกรรม + แผนงาน + เป้าหมาย
-- activity log เป็น input ของ 4 ระบบ: KPI targets · ladder เซลใหม่ · timeline · leaderboard
-- ============================================================

-- catalog กิจกรรม (ตรงกับ ACTION_GROUPS ใน lib/actions.ts)
-- attach = กิจกรรมนี้ผูกกับอะไรได้: lead / listing / either / none
create table if not exists action_type (
  name        text primary key,
  group_label text not null,
  attach      text not null default 'none' check (attach in ('lead','listing','either','none')),
  sort_order  integer default 0,
  is_active   boolean default true
);

insert into action_type (name, group_label, attach, sort_order) values
  ('Call','ไปป์ไลน์ (ลูกค้า)','lead',10),
  ('Follow','ไปป์ไลน์ (ลูกค้า)','lead',11),
  ('Appoint','ไปป์ไลน์ (ลูกค้า)','lead',12),
  ('Show','ไปป์ไลน์ (ลูกค้า)','lead',13),
  ('Nego','ไปป์ไลน์ (ลูกค้า)','lead',14),
  ('Close','ไปป์ไลน์ (ลูกค้า)','lead',15),
  ('Win','ไปป์ไลน์ (ลูกค้า)','lead',16),
  ('Owner Visit','งานทรัพย์','listing',20),
  ('Survey','งานทรัพย์','listing',21),
  ('ประเมิน','งานทรัพย์','listing',22),
  ('New List','งานทรัพย์','listing',23),
  ('ถ่ายรูป','งานทรัพย์','listing',24),
  ('Reels','งานทรัพย์','listing',25),
  ('ติดป้าย','งานทรัพย์','listing',26),
  ('โอน','งานทรัพย์','listing',27),
  ('ประชุม','ทั่วไป','none',30),
  ('ทำงานหน้าคอม','ทั่วไป','none',31),
  ('Sourcing','ทั่วไป','none',32),
  ('อื่นๆ','ทั่วไป','none',33),
  ('บันทึก','บันทึกโน้ต','either',40)
on conflict (name) do nothing;

comment on table action_type is
  'ชุดคำศัพท์กิจกรรมมาตรฐาน — ชีท Actions มี 23 ค่าที่เขียนไม่ตรงกัน (Show/Showing, Reels/ถ่าย Reels) ต้อง map เข้าชุดนี้ตอน import';

-- เป้าหมายรายเดือน (ทางการตั้งโดยหัวหน้า / stretch ตั้งเอง)
create table if not exists targets (
  id             bigint generated always as identity primary key,
  employee_code  text not null references main_1_hr (employee_code) on update cascade on delete cascade,
  month          text not null,                    -- 'YYYY-MM'
  label          text not null,
  kind           text not null default 'count' check (kind in ('count','baht','check','ratio')),
  target         numeric not null default 0,
  -- ความคืบหน้าที่เก็บไว้ (source=activity คำนวณสดจาก activities ไม่ใช้ช่องนี้)
  -- kind=ratio: manual_current = ตัวเศษ, denominator = ตัวส่วน, pct = เศษ/ส่วน
  manual_current numeric default 0,
  denominator    numeric,
  source         text not null default 'manual' check (source in ('activity','pipeline','manual','kpi')),
  activity_type  text references action_type (name) on update cascade,
  owner          text not null default 'stretch' check (owner in ('official','stretch')),
  -- จังหวะโฟกัสรายสัปดาห์ของ KPI ผู้บริหาร (Owner Talk=wk1, Sourcing/Survey=wk2-3, Buyer Follow=wk4)
  focus_week_start integer,
  focus_week_end   integer,
  focus_label      text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);
create index if not exists idx_targets_emp_month on targets (employee_code, month);

-- แผนวันนี้ — ติ๊กงานที่ผูก activity_type แล้วระบบเขียน activities ให้ (write path เดียวของกิจกรรม)
create table if not exists tasks (
  id            bigint generated always as identity primary key,
  employee_code text not null references main_1_hr (employee_code) on update cascade on delete cascade,
  task_date     date not null,
  title         text not null,
  done          boolean default false,
  sort_order    integer default 0,
  task_type     text not null default 'work' check (task_type in ('build','work','personal')),
  notes         text,
  target_id     bigint references targets (id) on delete set null,
  activity_type text references action_type (name) on update cascade,
  related_lead_id    text references main_6_buyer_crm (lead_id)         on update cascade on delete set null,
  related_listing_id text references main_4_listing_database (listing_id) on update cascade on delete set null,
  start_time    time,
  end_time      time,
  repeat_freq   text check (repeat_freq is null or repeat_freq in ('none','daily','weekdays','weekly','monthly')),
  repeat_weekdays  integer[],
  repeat_day_of_month integer,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create index if not exists idx_tasks_emp_date on tasks (employee_code, task_date);

-- บันทึกกิจกรรม
create table if not exists activities (
  id             bigint generated always as identity primary key,
  employee_code  text not null references main_1_hr (employee_code) on update cascade on delete cascade,
  action         text not null references action_type (name) on update cascade,
  activity_date  date not null,
  count          integer not null default 1 check (count > 0),
  remark         text,
  related_lead_id    text references main_6_buyer_crm (lead_id)          on update cascade on delete set null,
  related_listing_id text references main_4_listing_database (listing_id) on update cascade on delete set null,
  -- unique: ติ๊กงานเดิมซ้ำต้องไม่นับซ้ำ (idempotent) และ un-tick ต้องลบแถวนี้ทิ้ง
  task_id        bigint unique references tasks (id) on delete cascade,
  created_at     timestamptz default now()
);
create index if not exists idx_activities_emp_date on activities (employee_code, activity_date);
create index if not exists idx_activities_lead     on activities (related_lead_id);
create index if not exists idx_activities_listing  on activities (related_listing_id);

comment on column activities.task_id is
  'งานในแผนวันนี้ที่ทำให้เกิดแถวนี้ — unique เพื่อกันนับซ้ำตอนติ๊ก/ยกเลิกติ๊ก';
comment on column activities.activity_date is
  'ลงวันที่ตาม "วันของงาน" ไม่ใช่วันที่กด — ติ๊กงานย้อนหลังต้องลงวันนั้น';

-- ปุ่มลัดเพิ่มงานของแต่ละคน (เดิมเก็บใน localStorage)
create table if not exists user_quick_actions (
  id            bigint generated always as identity primary key,
  employee_code text not null references main_1_hr (employee_code) on update cascade on delete cascade,
  label         text not null,
  task_type     text not null default 'work' check (task_type in ('build','work','personal')),
  activity_type text references action_type (name) on update cascade,
  sort_order    integer default 0
);
create index if not exists idx_quick_actions_emp on user_quick_actions (employee_code);;
