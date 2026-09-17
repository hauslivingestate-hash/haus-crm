-- catalog สิทธิ์ — ตรงกับ PERMISSION_GROUPS ใน haus-crm/lib/rbac.ts (35 สิทธิ์)
insert into permissions (key, group_key, group_label, label, hint, sort_order) values
  ('leads.view_all','leads','Lead / ดีล','ดู Lead ทั้งหมด',null,10),
  ('leads.view_own','leads','Lead / ดีล','ดู Lead ของตัวเอง','เฉพาะที่ได้รับมอบหมาย',11),
  ('leads.create','leads','Lead / ดีล','เพิ่ม Lead (ปุ่มลอย)','รับสาย/แชท แล้วบันทึกลูกค้าเป็นลีด',12),
  ('leads.assign','leads','Lead / ดีล','มอบหมาย Lead',null,13),
  ('leads.edit','leads','Lead / ดีล','แก้ไข Lead',null,14),

  ('contacts.view_all','contacts','ผู้ติดต่อ','ดูผู้ติดต่อทั้งหมด',null,20),
  ('contacts.view_own','contacts','ผู้ติดต่อ','ดูเฉพาะที่สร้าง/ได้รับมอบหมาย',null,21),
  ('contacts.manage','contacts','ผู้ติดต่อ','จัดการผู้ติดต่อ',null,22),

  ('listings.view','inventory','คลังทรัพย์','ดูทรัพย์',null,30),
  ('listings.create','inventory','คลังทรัพย์','เพิ่มทรัพย์ใหม่','งานของเซลล์ — สร้างรายการทรัพย์ (แยกจากการแก้ไข)',31),
  ('listings.edit','inventory','คลังทรัพย์','แก้ไขทรัพย์',null,32),
  ('listings.marketing','inventory','คลังทรัพย์','การตลาด / ลงพอร์ทัล',null,33),
  ('projects.edit','inventory','คลังทรัพย์','แก้ไขโครงการ',null,34),
  ('lastmatch.add','inventory','คลังทรัพย์','เพิ่ม Last Match',null,35),
  ('lastmatch.view_all','inventory','คลังทรัพย์','ดู Last Match ทั้งบริษัท',null,36),
  ('lastmatch.view_team','inventory','คลังทรัพย์','ดู Last Match ของทีม','หัวหน้าทีมเห็นของลูกทีมทุกคน',37),
  ('lastmatch.view_own','inventory','คลังทรัพย์','ดู Last Match ของตัวเอง','เซลส์เห็นเฉพาะดีลที่ตัวเองปิด',38),

  ('activity.log','activity','กิจกรรม','บันทึกกิจกรรม','ติ๊กงานในแผนวันนี้แล้วระบบบันทึกกิจกรรมให้ — สำหรับคนที่ทำงานขาย',40),

  ('website.manage','website','เว็บพอร์ทัล','จัดการเนื้อหาเว็บหน้าบ้าน','เมนู / แบนเนอร์ / เนื้อหาบนเว็บพอร์ทัลลูกค้า — Marketing',50),

  ('performance.view_team','performance','เป้าหมาย / KPI','ดูผลงานทีม',null,60),
  ('performance.view_own','performance','เป้าหมาย / KPI','ดูผลงานตัวเอง',null,61),
  ('targets.set','performance','เป้าหมาย / KPI','ตั้งเป้าหมายให้ทีม',null,62),
  ('targets.stretch','performance','เป้าหมาย / KPI','ตั้งเป้าหมายส่วนตัวเพิ่ม',null,63),

  ('financials.view_comp','financials','การเงิน','ดูค่าตอบแทนของทีม (เงินเดือน/คอมมิชชั่น)','เงินเดือน + เรตคอมของพนักงาน — CEO/HR เท่านั้น',70),
  ('financials.payroll','financials','การเงิน','จัดการเงินเดือน',null,71),

  ('people.manage','people','บุคคล','จัดการพนักงาน (HR)',null,80),
  ('people.view_sensitive','people','บุคคล','ดูข้อมูลอ่อนไหว (บัตร ปชช./บัญชี/สลิป)','PII และเอกสารพนักงาน — CEO/HR เท่านั้น',81),
  ('teams.manage','people','บุคคล','จัดการทีมขาย','สร้างทีม กำหนดหัวหน้า และมอบหมายเซลเข้าทีม',82),
  ('leave.request','people','บุคคล','ขอลา','ยื่นใบลาจากหน้าแผนวันนี้',83),
  ('leave.manage','people','บุคคล','อนุมัติ / จัดการวันลา','ดูใบลาทุกคนและอนุมัติ — CEO / HR',84),

  ('masterdata.govern','masterdata','ข้อมูลหลัก','จัดการโซน & เทมเพลตกิจกรรม/KPI','โซน · ประเภทกิจกรรม · เทมเพลต KPI — CEO/หัวหน้า',90),
  ('reference.manage','masterdata','ข้อมูลหลัก','จัดการรายการอ้างอิง (ประเภททรัพย์ / ช่องทาง / ฟิลด์ Lead)','ประเภททรัพย์ · Marketing Channel · Contact By · เพศ · สัญชาติ',91),
  ('checklists.manage','masterdata','ข้อมูลหลัก','จัดการเช็คลิสต์ทรัพย์ (A-List / Exclusive)','เทมเพลตงานเพิ่มมูลค่าทรัพย์เด่น — CEO / Listing Support',92),
  ('copy.manage','masterdata','ข้อมูลหลัก','จัดการเทมเพลตคำโฆษณา','คำประกาศโฆษณาทรัพย์ (Headline / โพสต์ / DDproperty) — CEO / Marketing / Listing Support',93),

  ('roles.manage','system','ระบบ','จัดการบทบาท & สิทธิ์',null,100)
on conflict (key) do update
  set group_key=excluded.group_key, group_label=excluded.group_label,
      label=excluded.label, hint=excluded.hint, sort_order=excluded.sort_order;

insert into roles (id, name, description, is_system, sort_order) values
  ('ceo','CEO','ผู้บริหารสูงสุด — เข้าถึงทุกอย่าง กำหนดบทบาทและสิทธิ์',true,1),
  ('agent','Agent (Sales)','เซลส์ / ดูแลดีลของตัวเอง',false,2),
  ('listing_support','Listing Support','งานสนับสนุนการลงประกาศ/คลังทรัพย์ + มอบหมายดีล',false,3),
  ('marketing','Marketing','การตลาด / โซเชียล / ลงโฆษณา',false,4),
  ('sales_leader','Sales Leader','หัวหน้าทีมขาย',false,5),
  ('admin','Admin','งานธุรการ / รับลีดทุกช่องทาง + มอบหมายดีล (ยังไม่มีผู้ดำรงตำแหน่ง)',false,6),
  ('hr','HR','งานบุคคล / เงินเดือน (ยังไม่มีผู้ดำรงตำแหน่ง)',false,7)
on conflict (id) do update
  set name=excluded.name, description=excluded.description,
      is_system=excluded.is_system, sort_order=excluded.sort_order;

-- CEO = ทุกสิทธิ์ (superadmin)
insert into role_permissions (role_id, permission_key)
  select 'ceo', key from permissions on conflict do nothing;

insert into role_permissions (role_id, permission_key) values
  ('agent','leads.view_own'),('agent','leads.edit'),
  ('agent','contacts.view_own'),('agent','contacts.manage'),
  ('agent','listings.view'),('agent','listings.create'),('agent','listings.edit'),
  ('agent','lastmatch.add'),('agent','lastmatch.view_own'),
  ('agent','activity.log'),('agent','performance.view_own'),
  ('agent','targets.stretch'),('agent','leave.request'),

  ('listing_support','leads.create'),('listing_support','leads.assign'),
  ('listing_support','contacts.view_all'),
  ('listing_support','listings.view'),('listing_support','listings.edit'),
  ('listing_support','listings.marketing'),('listing_support','projects.edit'),
  ('listing_support','lastmatch.add'),('listing_support','lastmatch.view_all'),
  ('listing_support','reference.manage'),('listing_support','checklists.manage'),
  ('listing_support','copy.manage'),('listing_support','performance.view_own'),
  ('listing_support','targets.stretch'),('listing_support','leave.request'),

  ('marketing','listings.view'),('marketing','listings.marketing'),
  ('marketing','website.manage'),('marketing','copy.manage'),
  ('marketing','performance.view_own'),('marketing','targets.stretch'),
  ('marketing','leave.request'),

  ('sales_leader','leads.view_all'),('sales_leader','leads.create'),
  ('sales_leader','leads.edit'),('sales_leader','leads.assign'),
  ('sales_leader','contacts.view_all'),('sales_leader','contacts.manage'),
  ('sales_leader','listings.view'),('sales_leader','listings.create'),
  ('sales_leader','listings.edit'),('sales_leader','lastmatch.add'),
  ('sales_leader','lastmatch.view_team'),('sales_leader','activity.log'),
  ('sales_leader','performance.view_own'),('sales_leader','performance.view_team'),
  ('sales_leader','targets.set'),('sales_leader','targets.stretch'),
  ('sales_leader','leave.request'),

  ('admin','leads.view_all'),('admin','leads.create'),('admin','leads.edit'),
  ('admin','leads.assign'),('admin','contacts.view_all'),('admin','contacts.manage'),
  ('admin','listings.view'),('admin','leave.request'),

  ('hr','people.manage'),('hr','people.view_sensitive'),
  ('hr','financials.view_comp'),('hr','financials.payroll'),
  ('hr','performance.view_team'),('hr','leave.request'),('hr','leave.manage')
on conflict do nothing;;
