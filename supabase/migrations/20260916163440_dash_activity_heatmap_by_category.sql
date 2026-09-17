-- Replaces the `side`-grouped version created earlier in this same session. Its only
-- caller is lib/teamDashboard.ts, which is updated in the same change and is not yet
-- committed or deployed — no other object, view or policy references it.
drop function if exists public.dash_activity_heatmap(text[], date, date);

-- Now grouped by action_type.category (หมวดกิจกรรม), not `side`.
--
-- `side` answers "which half of the business", a three-value fact the pipeline cards
-- need. The heatmap asks a different question — what KIND of work was this — and Ben
-- chose the five HAUS V2 categories for it. Keeping both means neither has to be bent
-- into the other's shape.
--
-- An action with no category yet returns '' rather than being dropped: the work
-- happened, and a grid that quietly omits it would understate the day. The client files
-- '' under ไม่ระบุ and still counts it in ทั้งหมด.
create function public.dash_activity_heatmap(
  p_codes text[],
  p_from  date,
  p_to    date
)
returns table(employee_code text, day date, category text, total bigint)
language sql
stable
set search_path to 'public'
as $function$
  select
    a.employee_code,
    a.activity_date as day,
    coalesce(t.category, '') as category,
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
