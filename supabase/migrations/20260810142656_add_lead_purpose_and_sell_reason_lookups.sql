-- Phase 5 #3 (lead intake write path): the intake form collects "วัตถุประสงค์" (buyer) and
-- "เหตุผลที่ขาย/ปล่อย" (owner), which had no home in the schema at all — they lived only as
-- hard-coded arrays in lib/leads.ts. Same convention as every other dropdown here: a lookup
-- table keyed by `name`, so the stored value reads as itself.
create table if not exists public.lead_purpose (name text primary key);
insert into public.lead_purpose (name) values
  ('ซื้ออยู่เอง'), ('ลงทุน / ปล่อยเช่า'), ('เช่า')
on conflict (name) do nothing;

create table if not exists public.sell_reason (name text primary key);
insert into public.sell_reason (name) values
  ('ขยับขยาย'), ('ย้ายที่อยู่'), ('ต้องการเงินสด'), ('ขายทำกำไร'), ('อื่นๆ')
on conflict (name) do nothing;

-- RLS is force-enabled on new tables by Supabase's rls_auto_enable() event trigger, so
-- without these the dropdowns would read back empty for everyone. Same shape as the other
-- reference tables in db/rls_policies.sql §2: readable once signed in, written by whoever
-- governs reference data.
alter table public.lead_purpose enable row level security;
alter table public.sell_reason  enable row level security;

do $do$
declare t text;
begin
  foreach t in array array['lead_purpose','sell_reason'] loop
    execute format('drop policy if exists p_select on public.%I', t);
    execute format('drop policy if exists p_insert on public.%I', t);
    execute format('drop policy if exists p_update on public.%I', t);
    execute format('drop policy if exists p_delete on public.%I', t);
    execute format('create policy p_select on public.%I for select to authenticated using (true)', t);
    execute format($f$create policy p_insert on public.%I for insert to authenticated
      with check ((select has_perm('reference.manage')) or (select has_perm('masterdata.govern')) or (select has_perm('roles.manage')))$f$, t);
    execute format($f$create policy p_update on public.%I for update to authenticated
      using      ((select has_perm('reference.manage')) or (select has_perm('masterdata.govern')) or (select has_perm('roles.manage')))
      with check ((select has_perm('reference.manage')) or (select has_perm('masterdata.govern')) or (select has_perm('roles.manage')))$f$, t);
    execute format($f$create policy p_delete on public.%I for delete to authenticated
      using ((select has_perm('reference.manage')) or (select has_perm('masterdata.govern')) or (select has_perm('roles.manage')))$f$, t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end
$do$;
;
