-- ============================================================
-- RBAC: ย้ายจาก in-memory (lib/rbac.ts) มาอยู่ใน DB
-- ต้องอยู่ใน DB เพราะ RLS policy ต้องอ่านได้ ไม่ใช่แค่ซ่อนเมนูฝั่ง browser
-- ============================================================

-- catalog สิทธิ์ทั้งหมด (fixed — เพิ่มได้เมื่อโค้ดมี gate ใหม่)
create table if not exists permissions (
  key         text primary key,
  group_key   text not null,
  group_label text not null,
  label       text not null,
  hint        text,
  sort_order  integer default 0
);

create table if not exists roles (
  id          text primary key,
  name        text not null,
  description text,
  is_system   boolean default false,   -- ลบไม่ได้ (CEO)
  sort_order  integer default 0,
  created_at  timestamptz default now()
);

create table if not exists role_permissions (
  role_id        text not null references roles (id)       on update cascade on delete cascade,
  permission_key text not null references permissions (key) on update cascade on delete cascade,
  primary key (role_id, permission_key)
);

-- ทีมขาย (1 คน = 1 ทีม) — ต้องมีก่อน เพราะ visible_employee_codes() ใช้หา "ลูกทีม"
create table if not exists teams (
  id           text primary key,
  name         text not null,
  leader_code  text references main_1_hr (employee_code) on update cascade on delete set null,
  revenue_goal numeric,
  sort_order   integer default 0,
  created_at   timestamptz default now()
);

alter table main_1_hr add column if not exists team_id text references teams (id) on update cascade on delete set null;

-- user_roles ผูกกับ employee_code (ไม่ใช่ id ปลอม u_stone ในแอป)
-- 1 คนถือได้หลาย role — สิทธิ์จริง = union (เช่น Stone = CEO + Agent)
create table if not exists user_roles (
  employee_code text not null references main_1_hr (employee_code) on update cascade on delete cascade,
  role_id       text not null references roles (id)                on update cascade on delete cascade,
  primary key (employee_code, role_id)
);

create index if not exists idx_user_roles_role on user_roles (role_id);
create index if not exists idx_hr_auth_user    on main_1_hr (auth_user_id);

comment on table user_roles is
  'ใครถือ role อะไร — ว่างอยู่จนกว่าจะ import main_1_hr ของจริง (ตอนนี้ในตารางเป็นข้อมูล demo)';;
