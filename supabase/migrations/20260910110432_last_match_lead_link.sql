-- Which lead a Last Match row came from — and the guarantee that there is only ever one.
--
-- main_7_last_match is the log of how a property left the market: 20 sold by the owner, 14
-- taken by another agency, 16 closed by us (ปิดเอง). Our own closes belong in it, but until
-- now nothing recorded WHICH deal produced a row, so the app could not tell whether a lead
-- had already been logged. Saving the closing card twice — which is normal, you go back and
-- add the transfer date — would have written a second row for the same sale.
--
-- Nullable on purpose: the 56 imported rows have no lead to point at and never will. The
-- unique index is therefore partial, so those 56 do not collide with each other on NULL.
--
-- ON DELETE SET NULL, not CASCADE: if a lead is ever removed, the market record of that
-- property selling is still true. It just stops naming the lead.
alter table public.main_7_last_match
  add column if not exists lead_id text;

alter table public.main_7_last_match
  add constraint main_7_last_match_lead_id_fkey
  foreign key (lead_id) references public.main_6_buyer_crm(lead_id)
  on update cascade on delete set null;

create unique index if not exists uq_last_match_lead
  on public.main_7_last_match(lead_id)
  where lead_id is not null;

comment on column public.main_7_last_match.lead_id is
  'The lead whose closing card created this row. NULL for the 56 rows imported from the '
  'sheet and for any market comparable entered by hand. At most one row per lead '
  '(uq_last_match_lead).';;
