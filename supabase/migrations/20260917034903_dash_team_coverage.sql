-- Owner Talk % and Buyer Follow % — the two KPIs that are a SHARE OF A POPULATION rather
-- than a count against a target.
--
-- The rule, from HAUS V2's metrics-definitions.md §4: "once per month per qualified
-- owner". Every active listing's owner should be spoken to at least once a calendar month,
-- and the KPI is the share of active listings whose last-Owner-Talk date falls inside the
-- window. It RESETS on the 1st and climbs through the month — that is the intended
-- behaviour, not a bug, and it was raised and closed as such on 2026-07-20.
--
-- ⚠️ NUMERATOR AND DENOMINATOR COME FROM THE SAME POPULATION. HAUS V2 calls this out
-- explicitly because getting it wrong produces percentages over 100 that look like
-- over-performance. Both sides here count the SAME open-status rows; only the date filter
-- differs.
--
-- "Active" is `lead_status.is_open` / `listing_status.is_open` — the governed flags the
-- ติดตามเกินกำหนด card already uses, not a status name written into this function.
--
-- Listings are read through v_main_listing on `effective_sale_id`, which falls back to the
-- zone's primary agent. That is what "my listings" means everywhere else in the app, and
-- scoring somebody on a different population than their own page shows would be its own bug.
create or replace function public.dash_team_coverage(
  p_codes text[],
  p_from  date,
  p_to    date
)
returns table(employee_code text, metric text, done bigint, total bigint)
language sql
stable
set search_path to 'public'
as $function$
  select
    l.effective_sale_id,
    'owner_talk'::text,
    count(*) filter (where l.owner_talk_last_date between p_from and p_to)::bigint,
    count(*)::bigint
  from v_main_listing l
  join listing_status s on s.name = l.listing_status and s.is_open
  where l.effective_sale_id = any (p_codes)
  group by 1, 2

  union all

  select
    c.sale_id,
    'buyer_follow'::text,
    count(*) filter (where c.last_follow_date between p_from and p_to)::bigint,
    count(*)::bigint
  from main_6_buyer_crm c
  join lead_status s on s.name = c.lead_status and s.is_open
  where c.sale_id = any (p_codes)
  group by 1, 2
$function$;

revoke all on function public.dash_team_coverage(text[], date, date) from public;
grant execute on function public.dash_team_coverage(text[], date, date) to authenticated, service_role;;
