-- Phase 5 #1 (listing edit write path): inserting a brand-new owner via
-- `main_2_owner` INSERT ... RETURNING owner_id fails RLS, because the SELECT
-- policy only shows an owner row once some main_4 listing already points its
-- owner_id at it — which cannot be true yet for a row created this instant.
-- A SECURITY DEFINER RPC sidesteps that chicken-and-egg: it performs the same
-- authorization check as the existing INSERT policy, then inserts and returns
-- the id directly (no RETURNING-triggered SELECT-policy check, since the
-- function runs as its owner, which is exempt from RLS on this table).
create or replace function public.create_owner(p_name text, p_phone text, p_line text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare v_id bigint;
begin
  if not (has_perm('listings.create') or has_perm('listings.edit') or has_perm('roles.manage')) then
    raise exception 'insufficient permission' using errcode = '42501';
  end if;
  insert into main_2_owner (owner_name, owner_phone, owner_line)
    values (p_name, p_phone, p_line)
    returning owner_id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.create_owner(text, text, text) from anon;
;
