-- main_6_buyer_crm.listing_code was a bare text column: a lead could name a listing that
-- does not exist, and nothing in the database or the app would say so. Verified clean
-- before adding — 977 leads carry a code, 0 of them orphaned — so this changes no data.
--
-- ON UPDATE CASCADE, ON DELETE NO ACTION mirrors main_5_lead_database.listing_code, the
-- same reference on the sibling table. NO ACTION rather than the SET NULL used by
-- tasks/activities on purpose: which unit a customer was interested in is CRM history, and
-- silently blanking it because someone deleted the listing would destroy the record of why
-- the lead existed. Deleting a referenced listing now has to be a deliberate act.
create index if not exists idx_buyer_crm_listing_code
  on public.main_6_buyer_crm (listing_code);

alter table public.main_6_buyer_crm
  add constraint main_6_buyer_crm_listing_code_fkey
  foreign key (listing_code)
  references public.main_4_listing_database (listing_id)
  on update cascade
  on delete no action;;
