-- listing_support already held leads.create + leads.assign but neither leads.view_all nor
-- leads.view_own, so the role whose actual job is receiving and routing leads could not see
-- a single one — including the lead it had just created. Ben's call (2026-08-08) is that
-- back-office lead routing needs the full list to be meaningful.
insert into public.role_permissions (role_id, permission_key)
values ('listing_support', 'leads.view_all')
on conflict do nothing;
;
