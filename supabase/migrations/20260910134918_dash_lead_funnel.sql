-- กรวยการขาย — of the leads RECEIVED in this window, how far did each one get.
--
-- A COHORT, which is what makes it a funnel and not a snapshot. It follows one fixed
-- group of leads and asks how far each travelled, so every step counts everyone at or
-- beyond it and the bars can only narrow. The percentages are therefore real conversion
-- rates. The "leads sitting on each stage" view can never produce them: a lead that has
-- reached Show is simply absent from Lead, so the numbers do not nest and a ratio between
-- two of them means nothing.
--
-- FURTHEST REACHED, not current position. A lead that got to Nego and was then moved back
-- to Follow still passed through Nego, and a funnel that forgets that under-reports the
-- work. Taken from lead_stage_event where there is history and from the lead's current
-- stage otherwise — which is every pre-2026-09-10 lead, since the log starts there.
--
-- Ordering comes from `pipeline_stage.sort_order`, editable in ตั้งค่า. A stage inserted
-- in the middle re-ranks the funnel with no code change; one deleted drops out of it.
create or replace function public.dash_lead_funnel(
  p_sale_id text,
  p_from date,
  p_to date
)
returns table (stage text, sort_order int, reached bigint, cohort bigint)
language sql
stable
security invoker
set search_path to 'public'
as $$
  with cohort as (
    select c.lead_id, c.pipeline_stage
    from main_6_buyer_crm c
    where c.sale_id = p_sale_id
      and c.date_received between p_from and p_to
  ),
  furthest as (
    select
      k.lead_id,
      greatest(
        coalesce((select s.sort_order from pipeline_stage s where s.name = k.pipeline_stage), 0),
        coalesce((
          select max(s2.sort_order)
          from lead_stage_event e
          join pipeline_stage s2 on s2.name = e.to_stage
          where e.lead_id = k.lead_id and not e.baseline
        ), 0)
      ) as rank
    from cohort k
  ),
  n as (select count(*)::bigint as total from cohort)
  select
    s.name as stage,
    s.sort_order,
    (select count(*)::bigint from furthest f where f.rank >= s.sort_order) as reached,
    (select total from n) as cohort
  from pipeline_stage s
  order by s.sort_order
$$;

revoke all on function public.dash_lead_funnel(text, date, date) from public, anon;
grant execute on function public.dash_lead_funnel(text, date, date) to authenticated;;
