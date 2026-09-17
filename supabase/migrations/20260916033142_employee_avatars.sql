-- Staff profile photos (Ben, 2026-09-16). The FILE lives in the `avatars` storage
-- bucket; the employee row stores only the PATH.

alter table public.main_1_hr add column if not exists avatar_path text;

comment on column public.main_1_hr.avatar_path is
'Path inside the `avatars` storage bucket (e.g. "S-001/lm3k9f.webp"). NULL = no photo and the UI falls back to initials. The public URL is DERIVED from this (lib/avatar.ts), never stored: a stored URL embeds the project ref in every row and breaks the day the project moves.';

-- ⚠️ `authenticated` holds COLUMN-level select on main_1_hr (29 of 35 columns; salary,
-- id_card_no and the rest of the sensitive group are revoked and reach the app only via
-- v_employee_private). A NEW column is therefore not readable by default — without this
-- grant every avatar would silently read back NULL.
grant select (avatar_path) on public.main_1_hr to authenticated;

-- The bucket. Public-read like `listing-photos`: avatars render in list tables (the roster,
-- the ทีม dashboard, the ผู้ดูแล column), and signing a URL per row per request would cost a
-- round trip per face and defeat browser + CDN caching. The trade is that anyone holding a
-- URL may fetch it, so each filename carries a random segment and is never guessable from
-- the employee code alone.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 524288, array['image/webp','image/jpeg','image/png'])
on conflict (id) do nothing;

-- WRITE is people.manage / roles.manage — the same gate the ทีม record's แก้ไข button and
-- lib/mutations/employees.ts already use (Ben, 2026-09-16: HR/CEO set the photos).
drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects
  for select to public using (bucket_id = 'avatars');

drop policy if exists avatars_insert on storage.objects;
create policy avatars_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and ((select has_perm('people.manage')) or (select has_perm('roles.manage')))
  );

drop policy if exists avatars_update on storage.objects;
create policy avatars_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and ((select has_perm('people.manage')) or (select has_perm('roles.manage')))
  );

drop policy if exists avatars_delete on storage.objects;
create policy avatars_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and ((select has_perm('people.manage')) or (select has_perm('roles.manage')))
  );;
