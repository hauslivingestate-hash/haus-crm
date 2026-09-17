-- การปิดการขาย — one row per closed deal, and a credit list underneath it.
--
-- WHY THIS TABLE EXISTS. Until now a deal lived as five columns on the lead
-- (closing_price, closing_date, transfer_date, commission, case_closing_remark). The
-- company's own register — the "Finance" workbook, Revenue tab — holds things that shape
-- cannot: a STATUS (Pending / Success / Fail), FORECAST and REAL revenue as two figures
-- (they diverge whenever a นิติ fee, ส่วนกลาง or ค่าชดเชย comes off), CO-BROKE deals where
-- two agents split one commission, and ONE LEAD WITH TWO CASES (L26-655: one failed, one
-- succeeded). Measured on 2026-09-10: the register held 43 successful cases worth
-- ฿7,862,988; the lead columns could show ฿3,008,700 of it.
--
-- ONE DEAL, STORED ONCE. The register writes a co-broke deal as two rows (CC26-019 and
-- CO-CC26-019). Two rows can disagree about dates and status, and did. Here the deal is a
-- single row and closed_case_agent says who is credited and for how much. Company revenue
-- sums closed_case; a person's dashboard sums their shares; the two cannot drift.
--
-- THE LEAD'S FIVE COLUMNS ARE NO LONGER WRITTEN. They stay, with their old values, until
-- Ben decides to drop them — but nothing reads them after the import (see the
-- import migration for the reconciliation that makes that safe).
create table public.closed_case (
  case_id           text primary key,               -- 'CC26-001' — the register's own key
  lead_id           text references public.main_6_buyer_crm(lead_id)
                      on update cascade on delete set null,
  -- The register's raw Lead-ID when it matched nothing in the CRM (2025 leads, ลูกค้านอก).
  -- Kept so the link is recoverable and nothing is silently lost.
  lead_ref          text,
  listing_id        text references public.main_4_listing_database(listing_id)
                      on update cascade on delete set null,
  listing_ref       text,
  deal_type         text not null default 'sale' check (deal_type in ('sale', 'rent')),
  -- pending: signed, money not in.  success: transferred, money in.  fail: fell through.
  status            text not null default 'pending' check (status in ('pending', 'success', 'fail')),
  closing_date      date,                           -- วันเซ็นสัญญา
  transfer_date     date,                           -- วันโอน
  closing_price     numeric,
  -- FULL commission the company receives from the owner — gross, before VAT, the agent's
  -- share and withholding. Ben, 2026-09-10. Never the salesperson's take-home.
  forecast_revenue  numeric,                        -- what we expect at signing
  real_revenue      numeric,                        -- what actually arrived
  buyer_name        text,
  channel           text,
  unit_no           text,
  remark            text,
  is_cash           boolean not null default false,
  commission_slip   text,
  payout_status     text,                           -- the register's "Pay Commission" column, as written
  created_by        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index closed_case_lead_idx on public.closed_case (lead_id);
create index closed_case_closing_idx on public.closed_case (closing_date);
create index closed_case_transfer_idx on public.closed_case (transfer_date);

comment on table public.closed_case is
  'การปิดการขาย — one row per deal. Money here is the FULL commission the company receives. Who is credited, and for how much, is closed_case_agent.';

-- Who gets credit for a case, and how much of its money is theirs. A solo deal has one
-- row whose shares equal the case totals. Shares are AMOUNTS, not percentages, because
-- the register's own splits are not always even (CC26-026: ฿264,000 / ฿132,000).
create table public.closed_case_agent (
  case_id         text not null references public.closed_case(case_id)
                    on update cascade on delete cascade,
  employee_code   text not null references public.main_1_hr(employee_code)
                    on update cascade on delete restrict,
  is_primary      boolean not null default true,
  forecast_share  numeric,
  real_share      numeric,
  primary key (case_id, employee_code)
);

create index closed_case_agent_employee_idx on public.closed_case_agent (employee_code);

comment on table public.closed_case_agent is
  'Credit list for a closed case. Shares are baht, not %. Sum of shares = the case''s figure.';

-- ── Case ids ──────────────────────────────────────────────────────────────────
-- 'CC' + two-digit year + '-' + three-digit sequence, continuing the register's own
-- numbering so the two can be read side by side during the handover.
create or replace function public.next_case_id()
returns text
language sql
volatile
security invoker
set search_path to 'public'
as $$
  with yy as (select to_char(now() at time zone 'Asia/Bangkok', 'YY') as y)
  select 'CC' || y || '-' || lpad((
    coalesce(max(nullif(regexp_replace(case_id, '^CC' || y || '-', ''), case_id)::int), 0) + 1
  )::text, 3, '0')
  from yy left join closed_case on case_id like 'CC' || y || '-%'
  group by y
$$;

create or replace function public.closed_case_touch()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create trigger trg_closed_case_touch
  before update on public.closed_case
  for each row execute function public.closed_case_touch();

-- ── Access ────────────────────────────────────────────────────────────────────
-- Read: a case you are credited on; a leader sees the team's; leads.view_all sees all.
-- The same shape every performance surface uses, so "who may see whose numbers" has one
-- answer in this schema.
alter table public.closed_case enable row level security;
alter table public.closed_case_agent enable row level security;

create policy p_select on public.closed_case for select using (
  (select has_perm('leads.view_all'))
  or exists (
    select 1 from public.closed_case_agent a
    where a.case_id = closed_case.case_id
      and (a.employee_code = (select current_employee_code())
           or ((select has_perm('performance.view_team'))
               and a.employee_code in (select visible_employee_codes())))
  )
);

-- Write: the same gate as editing the lead. Closing is the ordinary end of the job.
create policy p_insert on public.closed_case for insert with check (
  (select has_perm('leads.edit')) or (select has_perm('leads.assign')) or (select has_perm('roles.manage'))
);

create policy p_update on public.closed_case for update using (
  (select has_perm('roles.manage'))
  or (((select has_perm('leads.edit')) or (select has_perm('leads.assign')))
      and ((select has_perm('leads.view_all'))
           or exists (select 1 from public.closed_case_agent a
                      where a.case_id = closed_case.case_id
                        and a.employee_code = (select current_employee_code()))))
);

-- Never deleted by a sale. A case that fell through is marked fail, not removed.
create policy p_delete on public.closed_case for delete using ((select has_perm('roles.manage')));

create policy p_select on public.closed_case_agent for select using (
  (select has_perm('leads.view_all'))
  or employee_code = (select current_employee_code())
  or ((select has_perm('performance.view_team'))
      and employee_code in (select visible_employee_codes()))
);

create policy p_write on public.closed_case_agent for all using (
  (select has_perm('leads.edit')) or (select has_perm('leads.assign')) or (select has_perm('roles.manage'))
) with check (
  (select has_perm('leads.edit')) or (select has_perm('leads.assign')) or (select has_perm('roles.manage'))
);

-- ── The dashboard's revenue, now off the case ─────────────────────────────────
--   close (default)  counted on closing_date, pending + success, the FORECAST share
--   win              counted on transfer_date, success only, the REAL share
-- Fail is never revenue at any date. lead_status.counts_as_revenue is no longer consulted:
-- the case carries its own status now.
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
  select
    to_char(case when p_basis = 'win' then c.transfer_date else c.closing_date end, 'YYYY-MM') as month,
    coalesce(sum(case when p_basis = 'win' then a.real_share else a.forecast_share end), 0)::numeric as total,
    count(*)::bigint as cases
  from closed_case_agent a
  join closed_case c on c.case_id = a.case_id
  where a.employee_code = p_sale_id
    and (case when p_basis = 'win' then c.transfer_date else c.closing_date end) between p_from and p_to
    and (case when p_basis = 'win' then c.status = 'success' else c.status in ('pending', 'success') end)
  group by 1
  order by 1
$$;;
