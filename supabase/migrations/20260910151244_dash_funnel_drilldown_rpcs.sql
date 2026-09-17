-- Which cases are behind one funnel bar.
--
-- These exist as functions rather than as a PostgREST query because "reached this step"
-- is not a column — it is the greatest of the lead's current stage and the furthest stage
-- in its event log. dash_lead_funnel already computes it to produce the count; if the
-- drill-down recomputed it in TypeScript the two could disagree, and a list that does not
-- match the number above it is worse than no list.
--
-- SECURITY INVOKER, so RLS still applies. The caller also passes the employee code.
create or replace function public.dash_funnel_leads(
  p_sale_id text, p_from date, p_to date, p_stage text
)
returns table(lead_id text, lead_name text, pipeline_stage text, date_received date)
language sql
stable
set search_path to 'public'
as $$
  with want as (
    select coalesce((select s.sort_order from pipeline_stage s where s.name = p_stage), 0) as rank
  )
  select
    c.lead_id,
    c.lead_name,
    c.pipeline_stage,
    c.date_received
  from main_6_buyer_crm c
  where c.sale_id = p_sale_id
    and c.date_received between p_from and p_to
    and greatest(
      coalesce((select s.sort_order from pipeline_stage s where s.name = c.pipeline_stage), 0),
      coalesce((
        select max(s2.sort_order)
        from lead_stage_event e
        join pipeline_stage s2 on s2.name = e.to_stage
        where e.lead_id = c.lead_id and not e.baseline
      ), 0)
    ) >= (select rank from want)
  order by c.date_received desc, c.lead_id
$$;

-- The acquisition twin. Same caveat as dash_owner_funnel: current stage only, because
-- there is no owner_stage event log yet.
create or replace function public.dash_owner_funnel_listings(
  p_sale_id text, p_from date, p_to date, p_stage text
)
returns table(listing_id text, owner_stage text, date_created date)
language sql
stable
set search_path to 'public'
as $$
  with want as (
    select coalesce((select s.sort_order from owner_stage s where s.name = p_stage), 0) as rank
  )
  select l.listing_id, l.owner_stage, l.date_created
  from main_4_listing_database l
  where l.sale_id = p_sale_id
    and l.date_created between p_from and p_to
    and coalesce((select s.sort_order from owner_stage s where s.name = l.owner_stage), 0)
        >= (select rank from want)
  order by l.date_created desc, l.listing_id
$$;

-- ทรัพย์ใหม่'s own list. Same window and filter as dash_new_listings, so the list can
-- never describe a different set than the count it opened from.
create or replace function public.dash_new_listing_rows(
  p_sale_id text, p_from date, p_to date
)
returns table(listing_id text, owner_stage text, date_created date)
language sql
stable
set search_path to 'public'
as $$
  select l.listing_id, l.owner_stage, l.date_created
  from main_4_listing_database l
  where l.sale_id = p_sale_id
    and l.date_created between p_from and p_to
  order by l.date_created desc, l.listing_id
$$;;
