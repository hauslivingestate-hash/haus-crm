-- Owner/contact visibility becomes own → team → all (Ben, 2026-08-13).
--
-- Before: only own → all. `sales_leader` sat in contacts.view_all, so a team lead saw every
-- owner in the company rather than their own people's. The middle tier this adds matches the
-- one main_7_last_match / activities / targets already use.
--
-- Listing Support KEEPS view_all: their job is phoning owners to arrange photos and postings
-- for listings they do not manage (main_4.sale_id is never an SP-xxx code), so scoping them
-- would leave them unable to see any owner at all.

insert into permissions (key, group_key, group_label, label, sort_order)
values ('contacts.view_team', 'contacts', 'ผู้ติดต่อ', 'ดูผู้ติดต่อของทีมตัวเอง', 21)
on conflict (key) do nothing;

-- A team lead sees their team, not the company.
delete from role_permissions where role_id = 'sales_leader' and permission_key = 'contacts.view_all';

insert into role_permissions (role_id, permission_key) values
  ('sales_leader', 'contacts.view_team'),
  -- system_admin holds every permission by explicit insert, never by wildcard — a new key
  -- that skips this line silently withholds it from the admin account.
  ('system_admin', 'contacts.view_team'),
  ('ceo',          'contacts.view_team')
on conflict do nothing;

-- ── contacts ────────────────────────────────────────────────────────────────
drop policy if exists p_select on contacts;
create policy p_select on contacts for select to authenticated
using (
  (select has_perm('contacts.view_all'))
  or (
    (select has_perm('contacts.view_team'))
    and (
      created_by in (select visible_employee_codes())
      or assigned_to in (select visible_employee_codes())
    )
  )
  or (
    (select has_perm('contacts.view_own'))
    and (
      created_by = (select current_employee_code())
      or assigned_to = (select current_employee_code())
    )
  )
);

drop policy if exists p_update on contacts;
create policy p_update on contacts for update to authenticated
using (
  ((select has_perm('contacts.manage')) or (select has_perm('roles.manage')))
  and (
    (select has_perm('contacts.view_all'))
    or (
      (select has_perm('contacts.view_team'))
      and (
        created_by in (select visible_employee_codes())
        or assigned_to in (select visible_employee_codes())
      )
    )
    or created_by = (select current_employee_code())
    or assigned_to = (select current_employee_code())
  )
)
with check (
  (select has_perm('contacts.manage')) or (select has_perm('roles.manage'))
);

-- ── main_2_owner ────────────────────────────────────────────────────────────
-- The owner table itself needs the same middle tier, or `sales_leader` — which just lost
-- view_all — would be able to see no owners at all.
drop policy if exists p_select on main_2_owner;
create policy p_select on main_2_owner for select to authenticated
using (
  (select has_perm('contacts.view_all'))
  or (select has_perm('roles.manage'))
  or exists (
    select 1 from main_4_listing_database l
    where l.owner_id = main_2_owner.owner_id
      and coalesce(l.sale_id, zone_primary_sale(l.zone)) = (select current_employee_code())
  )
  or (
    (select has_perm('contacts.view_team'))
    and exists (
      select 1 from main_4_listing_database l
      where l.owner_id = main_2_owner.owner_id
        and coalesce(l.sale_id, zone_primary_sale(l.zone)) in (select visible_employee_codes())
    )
  )
);;
