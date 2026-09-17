-- ทรัพย์ใหม่ — new listings signed up in the window, by the person who signed them up.
--
-- COUNTED FROM THE LISTINGS TABLE, NOT FROM `activities`, even though a "New List"
-- action type exists. A listing already carries its own dated row; counting the activity
-- as well would report one acquisition twice, and would report zero for anyone who
-- creates the listing without also logging the action. The table is the fact.
--
-- SECURITY INVOKER (the default) so RLS on main_4_listing_database still applies — this
-- is a ceiling, and the caller also passes the employee code explicitly.
create or replace function public.dash_new_listings(p_sale_id text, p_from date, p_to date)
returns bigint
language sql
stable
set search_path to 'public'
as $$
  select count(*)::bigint
  from main_4_listing_database l
  where l.sale_id = p_sale_id
    and l.date_created between p_from and p_to
$$;

comment on function public.dash_new_listings(text, date, date) is
  'Listings acquired in the window. Counted from the listings table on purpose — see the body.';

-- กรวยเจ้าของ — of the listings acquired in the window, how far the owner conversation got.
--
-- ⚠️ A SNAPSHOT, NOT A COHORT HISTORY, AND THE CARD MUST SAY SO.
-- The buyer funnel can say "furthest reached" because `lead_stage_event` records every
-- move. There is no equivalent log for owner_stage, so this reads each listing's CURRENT
-- stage and assumes the owner conversation only moves forward. A listing that reached
-- Exclusive Offer and was walked back to Owner Talk is counted at Owner Talk here, where
-- the buyer funnel would still credit the further step.
--
-- Building an owner_stage event log is the honest fix and is its own piece of work. Until
-- then this is a real number about where things stand, labelled as that and not as a
-- conversion rate.
create or replace function public.dash_owner_funnel(p_sale_id text, p_from date, p_to date)
returns table(stage text, sort_order integer, reached bigint, cohort bigint)
language sql
stable
set search_path to 'public'
as $$
  with cohort as (
    select l.listing_id, l.owner_stage
    from main_4_listing_database l
    where l.sale_id = p_sale_id
      and l.date_created between p_from and p_to
  ),
  ranked as (
    select
      k.listing_id,
      coalesce((select s.sort_order from owner_stage s where s.name = k.owner_stage), 0) as rank
    from cohort k
  ),
  n as (select count(*)::bigint as total from cohort)
  select
    s.name as stage,
    s.sort_order,
    (select count(*)::bigint from ranked r where r.rank >= s.sort_order) as reached,
    (select total from n) as cohort
  from owner_stage s
  order by s.sort_order
$$;

comment on function public.dash_owner_funnel(text, date, date) is
  'Acquisition funnel for listings taken on in the window. Reads current owner_stage — there is no owner stage event log, so a listing walked backwards is counted where it sits now.';;
