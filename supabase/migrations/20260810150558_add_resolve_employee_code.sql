-- Phase 5 #4: leads arrive naming their salesperson ("Sales Assigned" on the intake form),
-- but every sale_id column is an FK to employee_code. This is the one place that translation
-- happens, so it lives in the DB — n8n and any import script need it too, not just the web app.
--
-- Deliberately strict: EXACT, case-insensitive matches only, and a name matching more than one
-- active employee resolves to NULL rather than picking one. Two reasons — "Q" is a real
-- nickname here, so any substring/prefix matching would map half the roster onto it; and a
-- lead silently filed to the wrong agent is worse than one that shows up unassigned, because
-- nobody goes looking for a lead they never knew they had.
create or replace function public.resolve_employee_code(p_name text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  with needle as (select btrim(coalesce(p_name, '')) as n),
  matched as (
    select h.employee_code,
           -- Prefer nickname over given names, so a nickname that happens to equal someone
           -- else's first name still resolves to the nickname holder.
           case
             when lower(h.nickname)       = lower((select n from needle)) then 1
             when lower(h.first_name_en)  = lower((select n from needle)) then 2
             when lower(h.first_name_th)  = lower((select n from needle)) then 3
           end as rank
    from main_1_hr h
    where h.status = 'Active'
      and (select n from needle) <> ''
      and (
        lower(h.nickname)      = lower((select n from needle)) or
        lower(h.first_name_en) = lower((select n from needle)) or
        lower(h.first_name_th) = lower((select n from needle))
      )
  ),
  best as (select * from matched where rank = (select min(rank) from matched))
  select case when (select count(*) from best) = 1 then (select employee_code from best) end;
$$;

revoke execute on function public.resolve_employee_code(text) from anon;
;
