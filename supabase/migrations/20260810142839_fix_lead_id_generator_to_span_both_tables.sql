-- Found while testing create_lead: the generator only looked at main_5_lead_database, which
-- the 2026-08-03 import left EMPTY (all 953 leads went straight into main_6_buyer_crm). So
-- the next id came out as L26-001 while main_6 already holds L26-007 … L26-989 — the 7th
-- lead created through the app would have collided with a real existing lead's id and failed
-- the whole insert with 23505.
--
-- The two tables share one id space by design (main_6.lead_id mirrors main_5.lead_id), so
-- the generator has to consider both.
create or replace function public.set_lead_database_id()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare yy text := to_char(now(),'YY'); next_num int;
begin
  if new.lead_id is null or new.lead_id = '' then
    select coalesce(max((split_part(lead_id,'-',2))::int),0)+1 into next_num
    from (
      select lead_id from main_5_lead_database where lead_id like 'L' || yy || '-%'
      union all
      select lead_id from main_6_buyer_crm     where lead_id like 'L' || yy || '-%'
    ) all_leads;
    new.lead_id := 'L' || yy || '-' || lpad(next_num::text,3,'0');
  end if;
  return new;
end; $$;
;
