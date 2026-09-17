-- Ben (2026-08-08): only CEO and HR may create/reset another user's login. Separate from
-- people.manage (broader HR scope, already held by hr + ceo) because this one reaches
-- auth.users directly via the service_role admin client, not just main_1_hr.
-- system_admin is granted too, not as a business-role decision but to preserve its own
-- documented invariant ("ทุกสิทธิ์เสมอ") as the emergency superadmin account.
insert into permissions (key, group_key, group_label, label, hint, sort_order) values
  ('people.manage_accounts','people','บุคคล','จัดการบัญชีผู้ใช้ (สร้าง/ตั้งรหัสผ่าน)','สร้างบัญชี login ใหม่ + รีเซ็ตรหัสผ่าน — เข้าถึงบัญชี auth โดยตรง CEO / HR เท่านั้น',85);

insert into role_permissions (role_id, permission_key) values
  ('ceo','people.manage_accounts'),
  ('hr','people.manage_accounts'),
  ('system_admin','people.manage_accounts');
;
