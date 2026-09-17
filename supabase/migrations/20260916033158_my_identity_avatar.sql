-- my_identity() gains avatar_path so the topbar/sidebar photo costs no extra round trip.
-- Adding a column to a RETURNS TABLE signature needs drop + create, not replace.
-- Additive only: existing callers read columns by name and ignore the new one.
drop function if exists public.my_identity();

create function public.my_identity()
returns table(
  employee_code text,
  nickname text,
  team_id text,
  status text,
  avatar_path text,
  permissions text[]
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select h.employee_code,
         h.nickname,
         h.team_id,
         h.status,
         h.avatar_path,
         coalesce(
           (select array_agg(distinct rp.permission_key)
              from user_roles ur
              join role_permissions rp on rp.role_id = ur.role_id
             where ur.employee_code = h.employee_code),
           '{}'::text[]
         )
    from main_1_hr h
   where h.auth_user_id = auth.uid()
$function$;

grant execute on function public.my_identity() to authenticated;;
