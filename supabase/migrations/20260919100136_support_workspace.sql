-- โซน Support (/support) — Ben, 2026-09-19.
--
-- One permission gates the Support desk: the queue of listings to post (Ready to Post),
-- to update on the portals (Update / Sold / Cancel), the Facebook-group re-post board and
-- lead distribution. Keyed on a permission, never the role name, like every other gate.
insert into public.permissions (key, group_key, group_label, label, hint, sort_order) values
  ('support.workspace', 'inventory', 'คลังทรัพย์', 'โต๊ะงาน Support',
   'คิวลงประกาศ · อัปเดตประกาศ · โพสต์กลุ่ม Facebook · กระจายลีด — Listing Support', 34)
on conflict (key) do update set
  group_key = excluded.group_key, group_label = excluded.group_label,
  label = excluded.label, hint = excluded.hint, sort_order = excluded.sort_order;

-- System roles hold every permission as materialised rows, not a wildcard.
insert into public.role_permissions (role_id, permission_key)
select r.id, 'support.workspace' from public.roles r where r.is_system
on conflict do nothing;

insert into public.role_permissions (role_id, permission_key)
values ('listing_support', 'support.workspace')
on conflict do nothing;

-- Facebook-group posting and its boost are Listing Support's job, not Marketing's
-- (Ben, 2026-09-19). They are the two cadence steps of the A-List posting template.
update public.checklist_template_item i
set role = 'listing_support'
from public.checklist_template t
where t.id = i.template_id
  and t.name = 'ลงประกาศ A List'
  and i.item_type = 'cadence';

-- Record WHO changed a listing's status. support_id has been NULL on every row since the
-- table existed (562 rows) because the trigger never filled it; current_employee_code()
-- is null for imports and service calls, which is the honest value there.
create or replace function public.log_listing_status_change()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if tg_op = 'INSERT' then
    if new.listing_status is not null then
      insert into main_9_support_log (listing_id, action, status_before, status_after, support_id)
        values (new.listing_id, 'created', null, new.listing_status, (select current_employee_code()));
    end if;
  elsif tg_op = 'UPDATE' then
    if new.listing_status is distinct from old.listing_status then
      insert into main_9_support_log (listing_id, action, status_before, status_after, support_id)
        values (new.listing_id, 'status change', old.listing_status, new.listing_status,
                (select current_employee_code()));
    end if;
  end if;
  return null;
end;
$function$;
