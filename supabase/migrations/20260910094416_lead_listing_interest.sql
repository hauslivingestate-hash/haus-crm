-- Which units a buyer is shopping. Ben, 2026-09-10: one lead should hold several.
--
-- Until now interest was a single text column, main_6_buyer_crm.listing_code, so a buyer
-- looking at three units in the same building needed three leads or overwrote the first —
-- and the ผู้สนใจ card on a listing could only ever show the people whose ONE listing was
-- this one. A buyer is not a unit; they are a person with a budget looking at several.
create table if not exists public.lead_listing_interest (
  lead_id    text not null references public.main_6_buyer_crm (lead_id)
               on update cascade on delete cascade,
  listing_id text not null references public.main_4_listing_database (listing_id)
               on update cascade on delete cascade,
  created_at timestamptz not null default now(),
  created_by text,
  primary key (lead_id, listing_id)
);

-- ON DELETE CASCADE on both sides, unlike main_6_buyer_crm.listing_code which is NO ACTION.
-- The difference is deliberate: listing_code records WHICH UNIT A DEAL WAS ABOUT and is
-- history worth protecting, while a row here is only "they were curious" — when either end
-- is gone, the curiosity is not a fact anyone needs to keep.

-- The card reads listing → leads; the lead drawer reads lead → listings. The PK covers the
-- first direction only, so the reverse gets its own index.
create index if not exists idx_lead_interest_listing
  on public.lead_listing_interest (listing_id);

-- Backfill: every existing listing_code becomes an interest, so nothing that was recorded
-- before today is lost when the app starts reading this table instead.
insert into public.lead_listing_interest (lead_id, listing_id, created_by)
select c.lead_id, c.listing_code, 'import'
from public.main_6_buyer_crm c
where c.listing_code is not null
on conflict (lead_id, listing_id) do nothing;

alter table public.lead_listing_interest enable row level security;

-- Visibility follows the LEAD, exactly as activity does: the EXISTS runs under
-- main_6_buyer_crm's own RLS, so "can you see this interest" resolves to "can you see this
-- lead" and the two can never drift apart.
create policy p_select on public.lead_listing_interest for select using (
  exists (select 1 from public.main_6_buyer_crm c where c.lead_id = lead_listing_interest.lead_id)
);

-- Writing follows the same permission that edits a lead (rls_policies.sql §leads).
create policy p_insert on public.lead_listing_interest for insert with check (
  (select has_perm('leads.edit')) or (select has_perm('leads.assign')) or (select has_perm('roles.manage'))
);
create policy p_delete on public.lead_listing_interest for delete using (
  (select has_perm('leads.edit')) or (select has_perm('leads.assign')) or (select has_perm('roles.manage'))
);

grant select, insert, delete on public.lead_listing_interest to authenticated, service_role;;
