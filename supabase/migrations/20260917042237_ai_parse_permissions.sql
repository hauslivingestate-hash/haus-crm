-- สิทธิ์ AI — two gates, one per parse kind.
--
-- ── WHY TWO KEYS AND NOT ONE ────────────────────────────────────────────────────
-- Ben, 2026-09-17: lead parsing is a back-office leverage tool that Admin should have from
-- day one; listing parsing starts OFF for sales until the spend is proven. One key could
-- not express that, and a single `ai.parse` would have forced the stricter of the two onto
-- both. Splitting them is also what makes the ai_job INSERT policy able to say which kind a
-- person may queue.
--
-- Both appear in ตั้งค่า ▸ บทบาท & สิทธิ์ like every other permission, so turning listing
-- parsing on for Agent is a checkbox, not a migration.
insert into public.permissions (key, group_key, group_label, label, hint, sort_order) values
  ('ai.parse_lead', 'ai', 'AI / ผู้ช่วย', 'ให้ AI อ่านข้อความลีด',
   'วางแชท/ข้อความลูกค้าแล้วให้ AI กรอกฟอร์มลีดให้ — มีค่าใช้จ่ายต่อครั้ง', 94),
  ('ai.parse_listing', 'ai', 'AI / ผู้ช่วย', 'ให้ AI อ่านข้อความทรัพย์',
   'วางข้อความฝากขาย/โพสต์โบรกเกอร์แล้วให้ AI กรอกฟอร์มทรัพย์ให้ — มีค่าใช้จ่ายต่อครั้ง', 95)
on conflict (key) do update set
  group_key   = excluded.group_key,
  group_label = excluded.group_label,
  label       = excluded.label,
  hint        = excluded.hint,
  sort_order  = excluded.sort_order;

-- CEO and ผู้ดูแลระบบ hold every permission by definition — they are materialised rows here,
-- not a wildcard, so a new key has to be granted explicitly or it silently locks them out.
insert into public.role_permissions (role_id, permission_key)
select r.id, p.key
from public.roles r
cross join (values ('ai.parse_lead'), ('ai.parse_listing')) as p(key)
where r.is_system
on conflict do nothing;

-- Admin: lead parsing ON. Admin's whole job is taking leads off every channel and filing
-- them, so this is the one role where pasting a LINE conversation IS the work.
--
-- NOT granted: ai.parse_listing to anyone but the system roles. Sales starts OFF by
-- explicit decision — listing parsing is the more expensive habit and nobody has measured
-- it yet. Listing Support is the obvious next candidate for the lead key; left off because
-- it was not asked for.
insert into public.role_permissions (role_id, permission_key)
values ('admin', 'ai.parse_lead')
on conflict do nothing;;
