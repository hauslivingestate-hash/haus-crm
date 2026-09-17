-- ── รายได้ ────────────────────────────────────────────────────────────────────
-- Commission per month for one person, counted on the day the deal was SIGNED.
--
-- SIGNED, NOT TRANSFERRED. lib/deals.ts states the rule: closing_date is the contract,
-- transfer_date is the land office, and they are weeks apart. The sales scoreboard runs
-- on signed — the work finished when the contract was signed, and a scoreboard that waits
-- for the transfer reports July's performance in September. Anything cash-basis is a
-- different surface and must say so.
--
-- A lead at a status flagged counts_as_revenue = false is excluded at every date. See
-- that column's comment for the ฿300,000 this is worth in today's data.
--
-- SECURITY INVOKER: RLS on main_6_buyer_crm decides which leads are readable at all; the
-- p_sale_id argument is the filter on top of that ceiling.
create or replace function public.dash_revenue_monthly(
  p_sale_id text,
  p_from date,
  p_to date
)
returns table (month text, total numeric, cases bigint)
language sql
stable
security invoker
set search_path to 'public'
as $$
  select
    to_char(c.closing_date, 'YYYY-MM') as month,
    coalesce(sum(c.commission), 0)::numeric as total,
    count(*)::bigint as cases
  from main_6_buyer_crm c
  left join lead_status s on s.name = c.lead_status
  where c.sale_id = p_sale_id
    and c.closing_date between p_from and p_to
    and coalesce(s.counts_as_revenue, true)
  group by 1
  order by 1
$$;

revoke all on function public.dash_revenue_monthly(text, date, date) from public, anon;
grant execute on function public.dash_revenue_monthly(text, date, date) to authenticated;

-- ── ไปป์ไลน์ ──────────────────────────────────────────────────────────────────
-- Stage MOVEMENT inside a window, alongside where leads stand right now.
--
-- Both numbers, because they answer different questions. `moves` is work done; `standing`
-- is work waiting. A stage with 12 moves and 0 standing is one leads pass straight
-- through; 0 moves and 12 standing is where the pipeline is stuck.
--
-- Baselines are excluded — they are the rows written when the log was created for leads
-- that already existed, and counting them would report ~900 moves that never happened.
--
-- FULL OUTER JOIN so a stage with movement but nobody standing there (and the reverse)
-- still appears. An inner join would quietly drop exactly the interesting rows.
create or replace function public.dash_stage_moves(
  p_sale_id text,
  p_from date,
  p_to date
)
returns table (stage text, moves bigint, standing bigint)
language sql
stable
security invoker
set search_path to 'public'
as $$
  with mv as (
    select e.to_stage as stage, count(*)::bigint as n
    from lead_stage_event e
    where e.sale_id = p_sale_id
      and not e.baseline
      and e.to_stage is not null
      -- `at` is timestamptz; the window is Bangkok calendar days, not UTC ones.
      and (e.at at time zone 'Asia/Bangkok')::date between p_from and p_to
    group by e.to_stage
  ),
  st as (
    select c.pipeline_stage as stage, count(*)::bigint as n
    from main_6_buyer_crm c
    where c.sale_id = p_sale_id and c.pipeline_stage is not null
    group by c.pipeline_stage
  )
  select coalesce(mv.stage, st.stage) as stage,
         coalesce(mv.n, 0) as moves,
         coalesce(st.n, 0) as standing
  from mv full outer join st on mv.stage = st.stage
$$;

revoke all on function public.dash_stage_moves(text, date, date) from public, anon;
grant execute on function public.dash_stage_moves(text, date, date) to authenticated;;
