-- Phase 5 #4: accept a salesperson NAME as well as a code. Leads arriving from the intake
-- form / n8n carry "Sales Assigned" as a name, and this is where it becomes an employee_code.
--
-- An unresolvable name does NOT fail the insert: the lead is still created with sale_id null
-- and surfaces under the "ยังไม่มอบหมาย" filter on /assign. Losing a real customer enquiry
-- because a name was misspelled would be the worse outcome by far.
create or replace function public.create_lead(p jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead_id text;
  v_sale_id text;
begin
  if not (has_perm('leads.create') or has_perm('roles.manage')) then
    raise exception 'insufficient permission' using errcode = '42501';
  end if;

  if coalesce(btrim(p->>'lead_name'), '') = '' then
    raise exception 'lead_name is required' using errcode = '23514';
  end if;

  -- An explicit code wins; otherwise translate the name. Both may be absent (unassigned).
  v_sale_id := nullif(p->>'sale_id', '');
  if v_sale_id is null then
    v_sale_id := resolve_employee_code(p->>'sale_name');
  end if;

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
    v_sale_id,
    nullif(p->>'contact_date', '')::date,
    nullif(p->>'contact_time', '')::time,
    nullif(p->>'marketing_channel', ''),
    nullif(p->>'contact_by', '')
  )
  returning lead_id into v_lead_id;

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
    v_sale_id,
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
