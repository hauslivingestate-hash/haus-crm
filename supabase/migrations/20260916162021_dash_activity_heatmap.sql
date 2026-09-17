-- กิจกรรมรายวัน × คน — the ทีม tab's activity heatmap.
--
-- One row per (person, day, side) for the window, so a month for a six-person team is
-- ~550 rows instead of the ~2,000 raw activity rows behind them. Grouped in Postgres for
-- the same reason dash_activity_counts is: the answer is a small grid and the log is not.
--
-- `side` comes from action_type, NOT from a list in code — the same governed vocabulary
-- the dashboard's other activity reads use. An action with no action_type row (which the
-- FK should prevent, but a left join is cheaper than being wrong) falls into 'general'
-- rather than vanishing from the grid.
--
-- SECURITY INVOKER, like every other dash_* function: the RLS on `activities` already
-- says own-rows OR (performance.view_team AND visible_employee_codes()). The caller
-- still filters p_codes explicitly — RLS is a ceiling, not a filter.
create or replace function public.dash_activity_heatmap(
  p_codes text[],
  p_from  date,
  p_to    date
)
returns table(employee_code text, day date, side text, total bigint)
language sql
stable
set search_path to 'public'
as $function$
  select
    a.employee_code,
    a.activity_date as day,
    coalesce(t.side, 'general') as side,
    sum(coalesce(a.count, 1))::bigint as total
  from activities a
  left join action_type t on t.name = a.action
  where a.employee_code = any (p_codes)
    and a.activity_date between p_from and p_to
  group by 1, 2, 3
  order by 1, 2, 3
$function$;

revoke all on function public.dash_activity_heatmap(text[], date, date) from public;
grant execute on function public.dash_activity_heatmap(text[], date, date) to authenticated, service_role;;
