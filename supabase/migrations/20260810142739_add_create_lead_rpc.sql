-- Phase 5 #3: intake writes TWO rows — main_5_lead_database (the arrival record, whose
-- trigger mints the L26-### id) and main_6_buyer_crm (the CRM row sales work), linked by
-- lead_ref. Doing that from the client would need `INSERT ... RETURNING lead_id` on main_5
-- to learn the generated id, and RETURNING is checked against the SELECT policy — which is
-- `leads.view_all OR (leads.view_own AND sales_id = me)`. An admin filing a lead FOR someone
-- else, and listing_support (which holds neither), cannot see the row they just wrote, so
-- the insert would fail with 42501. Exactly the trap main_2_owner hit; same fix.
--
-- Both inserts run in one function = one transaction, so a lead can never end up half
-- written. Authorization is checked here against the same permission the INSERT policies
-- use, so this grants no reach the caller didn't already have.
--
-- Takes jsonb rather than ~18 positional params: the intake form is still growing, and the
-- real type boundary is the TypeScript server action that calls this.
create or replace function public.create_lead(p jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_lead_id text;
begin
  if not (has_perm('leads.create') or has_perm('roles.manage')) then
    raise exception 'insufficient permission' using errcode = '42501';
  end if;

  if coalesce(btrim(p->>'lead_name'), '') = '' then
    raise exception 'lead_name is required' using errcode = '23514';
  end if;

  -- main_5: the intake record. lead_id is left null so trg_set_lead_database_id mints it.
  insert into main_5_lead_database (
    date_received, lead_type, listing_code, lead_name, phone, line_id,
    gender, nationality, remark, sales_id,
    contact_date, contact_time, marketing_channel, contact_by
  ) values (
    coalesce((p->>'date_received')::date, current_date),
    nullif(p->>'lead_type', ''),
    nullif(p->>'listing_code', ''),
    btrim(p->>'lead_name'),
    nullif(btrim(coalesce(p->>'phone', '')), ''),
    nullif(p->>'line_id', ''),
    nullif(p->>'gender', ''),
    nullif(p->>'nationality', ''),
    nullif(p->>'remark', ''),
    nullif(p->>'sale_id', ''),
    nullif(p->>'contact_date', '')::date,
    nullif(p->>'contact_time', '')::time,
    nullif(p->>'marketing_channel', ''),
    nullif(p->>'contact_by', '')
  )
  returning lead_id into v_lead_id;

  -- main_6: the CRM row, same id, linked back via lead_ref. A brand-new lead always starts
  -- at the 'Lead' stage / 'Active' status — that is what makes the derived "has the sale
  -- contacted them yet" read false until someone moves it on.
  insert into main_6_buyer_crm (
    lead_id, lead_ref, date_received, listing_code, lead_type, sale_id,
    lead_name, phone, line_id, admin_remark, budget,
    potential, lead_status, pipeline_stage,
    marketing_channel, contact_by, gender, nationality, contact_date, contact_time,
    interest_zone, interest_property_type, purpose, sell_reason
  ) values (
    v_lead_id, v_lead_id,
    coalesce((p->>'date_received')::date, current_date),
    nullif(p->>'listing_code', ''),
    nullif(p->>'lead_type', ''),
    nullif(p->>'sale_id', ''),
    btrim(p->>'lead_name'),
    nullif(btrim(coalesce(p->>'phone', '')), ''),
    nullif(p->>'line_id', ''),
    nullif(p->>'remark', ''),
    nullif(p->>'budget', '')::numeric,
    coalesce(nullif(p->>'potential', ''), 'New Lead'),
    'Active',
    'Lead',
    nullif(p->>'marketing_channel', ''),
    nullif(p->>'contact_by', ''),
    nullif(p->>'gender', ''),
    nullif(p->>'nationality', ''),
    nullif(p->>'contact_date', '')::date,
    nullif(p->>'contact_time', '')::time,
    nullif(p->>'interest_zone', ''),
    nullif(p->>'interest_property_type', ''),
    nullif(p->>'purpose', ''),
    nullif(p->>'sell_reason', '')
  );

  return v_lead_id;
end;
$$;

revoke execute on function public.create_lead(jsonb) from anon;
;
