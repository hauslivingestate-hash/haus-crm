-- Reverts add_contacts_view_team_scope (same day). Ben: หัวหน้าทีมให้เห็นทั้งหมด.
--
-- With a team lead back in the "all" tier there is nobody left in the middle, so the
-- permission and the extra policy branch are dead weight — remove them rather than leave a
-- key nobody holds. This restores exactly the own → all shape that shipped in Phase 4.

-- Give the leader company-wide sight again. (Deleting the permission cascades its grants.)
insert into role_permissions (role_id, permission_key)
values ('sales_leader', 'contacts.view_all')
on conflict do nothing;

delete from permissions where key = 'contacts.view_team';

-- ── contacts ────────────────────────────────────────────────────────────────
drop policy if exists p_select on contacts;
create policy p_select on contacts for select to authenticated
using (
  (select has_perm('contacts.view_all'))
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
    or created_by = (select current_employee_code())
    or assigned_to = (select current_employee_code())
  )
)
with check (
  (select has_perm('contacts.manage')) or (select has_perm('roles.manage'))
);

-- ── main_2_owner ────────────────────────────────────────────────────────────
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
);;
