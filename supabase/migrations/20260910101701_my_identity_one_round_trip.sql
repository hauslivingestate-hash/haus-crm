-- Who the caller is, in ONE round trip.
--
-- lib/auth.ts built the same answer with three chained queries — main_1_hr, then
-- user_roles, then role_permissions — each waiting on the one before it. From Bangkok to
-- this project in ap-southeast-2 that is ~0.4s apiece, and getAuthContext() runs more than
-- once per page render, so identity alone cost more than every piece of real data on the
-- screen combined.
--
-- Same shape as the existing my_permissions(): SECURITY DEFINER because it must read the HR
-- and role tables regardless of the caller's own RLS, and safe because the WHERE clause is
-- pinned to auth.uid() — it can only ever describe the caller. There is no argument to pass,
-- so there is nothing to point it at somebody else.
--
-- Returns zero rows when the account is signed in but not linked to an employee. That is not
-- an error: the caller is valid, it just grants nothing. `status` is returned rather than
-- filtered on, so the app keeps deciding what "Terminate" means.
create or replace function public.my_identity()
returns table (
  employee_code text,
  nickname      text,
  team_id       text,
  status        text,
  permissions   text[]
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select h.employee_code,
         h.nickname,
         h.team_id,
         h.status,
         coalesce(
           (select array_agg(distinct rp.permission_key)
              from user_roles ur
              join role_permissions rp on rp.role_id = ur.role_id
             where ur.employee_code = h.employee_code),
           '{}'::text[]
         )
    from main_1_hr h
   where h.auth_user_id = auth.uid()
$$;

revoke all on function public.my_identity() from public;
revoke all on function public.my_identity() from anon;
grant execute on function public.my_identity() to authenticated;;
