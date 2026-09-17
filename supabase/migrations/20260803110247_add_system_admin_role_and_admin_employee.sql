-- บทบาทผู้ดูแลระบบ — แยกจาก 'ceo' ตั้งใจ
-- 'ceo' เป็นตำแหน่งจริงในบริษัท (Stone) ถ้าเอาไปให้บัญชีแอดมินด้วย
-- ทุกรายงาน/หน้าบทบาทจะนับว่ามี CEO 2 คน
insert into roles (id, name, description, is_system, sort_order) values
  ('system_admin','ผู้ดูแลระบบ',
   'บัญชีสำหรับตั้งค่า/ดูแลระบบ — ไม่ใช่ตำแหน่งในโครงสร้างบริษัท',
   true, 0)
on conflict (id) do update set name=excluded.name, description=excluded.description;

insert into role_permissions (role_id, permission_key)
  select 'system_admin', key from permissions on conflict do nothing;

-- แถวพนักงานสำหรับบัญชีแอดมิน — จำเป็นเพราะสิทธิ์ทั้งระบบวิ่งผ่าน employee_code
-- prefix E = ไม่เข้าเกณฑ์ Sales/Support/ตำแหน่งบริหาร (ตามตรรกะ trigger เดิม)
-- second_position = null -> ไม่โผล่ในรายชื่อเซลตอนมอบหมายลีด
insert into main_1_hr (employee_code, status, nickname, email, remark)
values ('E-001','Active','Admin','hauslivingestate@gmail.com',
        'บัญชีผู้ดูแลระบบ ไม่ใช่พนักงานในโครงสร้างบริษัท')
on conflict (employee_code) do update set
  nickname=excluded.nickname, email=excluded.email, remark=excluded.remark;

insert into user_roles (employee_code, role_id) values ('E-001','system_admin')
on conflict do nothing;;
