alter table public.main_4_listing_database
  add column if not exists owner_stage text;

comment on column public.main_4_listing_database.owner_stage is
  'Owner-side pipeline: where the relationship with the seller stands. Distinct from listing_status, which is the marketing queue for the advert.';

alter table public.main_4_listing_database
  add constraint main_4_listing_database_owner_stage_fkey
  foreign key (owner_stage) references public.owner_stage (name)
  on update cascade
  on delete no action;

create index if not exists idx_listing_owner_stage
  on public.main_4_listing_database (owner_stage);

-- BACKFILL. Writes only into the column just added, so nothing existing is overwritten.
--
-- The floor is `Listed`: a row in the listing database means the owner already agreed to
-- let us sell it, so the relationship reached "ได้ทรัพย์" by definition. The earlier stages
-- (Sourcing → Owner Talk → Owner Visit → Appraise) describe getting to that point, and the
-- database has no record of which listings passed through them — that history starts being
-- recorded from today.
--
-- Two states the data DOES know, applied over the floor:
--   sold/cancelled  — listing_status says so outright
--   Exclusive       — an agreement_start date exists, which is what exclusivity means here
update public.main_4_listing_database
set owner_stage = case
  when listing_status in ('Sold', 'Sold Completed')     then 'Sold'
  when listing_status in ('Cancel', 'Cancel Completed') then 'Dropped'
  when agreement_start is not null                      then 'Exclusive'
  else 'Listed'
end
where owner_stage is null;;
