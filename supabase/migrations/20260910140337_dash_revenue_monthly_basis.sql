-- รายได้: two answers, and they are supposed to differ.
--
--   close (default)  counted on closing_date — the contract was signed. The FORECAST:
--                    work finished, money not yet in. This is what scores the sales game;
--                    waiting for the transfer would report July's performance in September.
--   win              counted on transfer_date — the land office completed. The ACTUAL.
--
-- Ben, 2026-09-10: the card and the trend both toggle between them, default close, "so
-- that the sales or anyone can see both forecast and actual revenue". lib/deals.ts has
-- carried this distinction (RevenueBasis) since the close form was built; this is the
-- first surface to expose it.
--
-- A deal signed in April and transferred in July belongs to April on one basis and July
-- on the other, and BOTH are correct. They must never be reconciled into one number.
--
-- ⚠️ ONE COMMISSION COLUMN. The accounting workbook carries Forecast REV. and Real Revenue
-- as two separate figures (they diverge when a commission is renegotiated — CC25-003 went
-- ฿150,000 → ฿100,000). The CRM stores one. So the two bases here differ by WHEN a deal
-- counts, not by how much it is worth. Splitting the amount needs a second column and
-- Ben's decision on which one `commission` currently holds.
create or replace function public.dash_revenue_monthly(
  p_sale_id text,
  p_from date,
  p_to date,
  p_basis text default 'close'
)
returns table (month text, total numeric, cases bigint)
language sql
stable
security invoker
set search_path to 'public'
as $$
  with d as (
    select
      case when p_basis = 'win' then c.transfer_date else c.closing_date end as counted_on,
      c.commission,
      c.sale_id,
      c.lead_status
    from main_6_buyer_crm c
  )
  select
    to_char(d.counted_on, 'YYYY-MM') as month,
    coalesce(sum(d.commission), 0)::numeric as total,
    count(*)::bigint as cases
  from d
  left join lead_status s on s.name = d.lead_status
  where d.sale_id = p_sale_id
    and d.counted_on between p_from and p_to
    and coalesce(s.counts_as_revenue, true)
  group by 1
  order by 1
$$;

revoke all on function public.dash_revenue_monthly(text, date, date, text) from public, anon;
grant execute on function public.dash_revenue_monthly(text, date, date, text) to authenticated;

-- The 3-argument version is gone: every caller passes a basis now, and leaving an
-- overload that silently means "close" is how a caller ends up on the wrong basis
-- without saying so.
drop function if exists public.dash_revenue_monthly(text, date, date);;
