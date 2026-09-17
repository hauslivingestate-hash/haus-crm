-- Phase 5 #3: what the customer is actually looking for. The intake form has collected
-- these since the design phase but had nowhere to put them.
--
-- These go on main_6_buyer_crm rather than main_5_lead_database because main_5 is the
-- frozen "what arrived at intake" record while main_6 is the row sales actually work and
-- refine — and every read path in the app (getCrm/getLead) already goes through main_6.
-- Same reasoning that moved the other intake columns here on 2026-08-03.
--
-- Owner asking price needs no column: the form already maps it onto `budget`, which is
-- documented as "buyer budget or owner asking price".
alter table public.main_6_buyer_crm
  add column if not exists interest_zone          text references public.zone (zone_id)          on update cascade,
  add column if not exists interest_property_type text references public.property_type (name)    on update cascade,
  add column if not exists purpose                text references public.lead_purpose (name)     on update cascade,
  add column if not exists sell_reason            text references public.sell_reason (name)      on update cascade;
;
