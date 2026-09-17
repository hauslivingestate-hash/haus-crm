-- KPI ทีมขาย — every work goal's PROGRESS for a whole team in one call.
--
-- A `targets` row is scored against one of three sources, and each is counted a different
-- way. This function reproduces each one EXACTLY as the per-person card already does, so
-- the team grid and a salesperson's own dashboard can never disagree about the same
-- number:
--
--   activity     sum of `activities.count` for that action   (= dash_activity_counts)
--   owner_stage  listings CREATED in the window whose stage reached it (= dash_owner_funnel)
--   stage        leads RECEIVED in the window whose FURTHEST stage reached it
--                (= dash_lead_funnel — furthest, not current, because a lead can go back
--                 and a funnel that forgets it ever got to Show is not a funnel)
--
-- ⚠️ Two of the three count RECORDS, not actions. Logging "New List" as an activity does
-- not move a `New List` owner_stage goal — that goal counts listings that reached the
-- stage. The two vocabularies share names and are not the same thing.
--
-- SECURITY INVOKER like every other dash_* function; the caller still filters p_codes
-- explicitly, because RLS is a ceiling and not a filter.
create or replace function public.dash_team_kpi(
  p_codes text[],
  p_from  date,
  p_to    date
)
returns table(employee_code text, source text, metric text, done bigint)
language sql
stable
set search_path to 'public'
as $function$
  select a.employee_code, 'activity'::text, a.action, sum(coalesce(a.count, 1))::bigint
  from activities a
  where a.employee_code = any (p_codes)
    and a.activity_date between p_from and p_to
  group by 1, 2, 3

  union all

  select l.sale_id, 'owner_stage'::text, s.name, count(*)::bigint
  from main_4_listing_database l
  left join owner_stage cur on cur.name = l.owner_stage
  cross join owner_stage s
  where l.sale_id = any (p_codes)
    and l.date_created between p_from and p_to
    and s.sort_order <= coalesce(cur.sort_order, 0)
  group by 1, 2, 3

  union all

  select f.sale_id, 'stage'::text, s.name, count(*)::bigint
  from (
    select
      c.lead_id,
      c.sale_id,
      greatest(
        coalesce((select s0.sort_order from pipeline_stage s0 where s0.name = c.pipeline_stage), 0),
        coalesce((
          select max(s2.sort_order)
          from lead_stage_event e
          join pipeline_stage s2 on s2.name = e.to_stage
          where e.lead_id = c.lead_id and not e.baseline
        ), 0)
      ) as rank
    from main_6_buyer_crm c
    where c.sale_id = any (p_codes)
      and c.date_received between p_from and p_to
  ) f
  cross join pipeline_stage s
  where s.sort_order <= f.rank
  group by 1, 2, 3
$function$;

revoke all on function public.dash_team_kpi(text[], date, date) from public;
grant execute on function public.dash_team_kpi(text[], date, date) to authenticated, service_role;;
