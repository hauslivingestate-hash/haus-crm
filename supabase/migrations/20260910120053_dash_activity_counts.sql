-- แดชบอร์ดขาย: how much work one person logged in a window, grouped by action.
--
-- WHY AN RPC RATHER THAN A SELECT. PostgREST cannot GROUP BY, so the alternative is
-- fetching every activity row in the window and reducing in JS. For "ปีนี้" that is
-- ~1,600 rows crossing the network to produce twenty numbers. The dashboard's whole
-- premise is that the aggregate happens in Postgres.
--
-- SECURITY INVOKER, deliberately. RLS on `activities` already says who may read whose
-- rows (own, or the team when you hold performance.view_team). A SECURITY DEFINER
-- function would bypass that and make this the one door in the app where an agent could
-- read a colleague's numbers. The caller also passes p_employee_code explicitly, so the
-- filter and the policy have to agree — RLS is the ceiling, the argument is the filter.
--
-- SUM(count), not COUNT(*). One `activities` row carries a tally: "Call, 12". Counting
-- rows would report the number of times someone filled in the form, not the work done.
-- COALESCE to 1 matches how the lead timeline reads the same column.
create or replace function public.dash_activity_counts(
  p_employee_code text,
  p_from date,
  p_to date
)
returns table (action text, total bigint)
language sql
stable
security invoker
set search_path to 'public'
as $$
  select a.action, sum(coalesce(a.count, 1))::bigint as total
  from activities a
  where a.employee_code = p_employee_code
    and a.activity_date between p_from and p_to
  group by a.action
  order by 2 desc, 1
$$;

revoke all on function public.dash_activity_counts(text, date, date) from public, anon;
grant execute on function public.dash_activity_counts(text, date, date) to authenticated;

comment on function public.dash_activity_counts(text, date, date) is
  'แดชบอร์ดขาย — activity totals per action for one employee over a date window. SECURITY INVOKER: RLS on activities decides whose rows are readable.';;
