-- ประวัติการเปลี่ยนขั้นตอน — every move a lead makes through the buyer pipeline.
--
-- WHY THIS EXISTS. The dashboard's pipeline card counts MOVEMENT in a window ("how many
-- leads reached Show this month"), not where leads sit today. A count of current
-- positions has no time dimension at all — it reads identically for วันนี้ and ปีนี้,
-- which is the one thing a filtered dashboard must not do. Nothing in this schema could
-- answer the movement question: audit_log holds the before/after, but it is readable
-- only with roles.manage, so a sale cannot see their own history in it.
--
-- WHY A TRIGGER AND NOT APP CODE. Three server actions already move a stage
-- (mutations/activity.ts, mutations/leads.ts, mutations/deals.ts) and more will. Writing
-- the log from each of them is three places to forget, and a spreadsheet import or a
-- fix applied in the SQL console would bypass all three. A trigger cannot be routed
-- around. The cost is that it only knows the actor as current_employee_code() — null for
-- a service-role import, which is honest: nobody in the app did it.
create table public.lead_stage_event (
  id          bigserial primary key,
  lead_id     text not null references public.main_6_buyer_crm(lead_id)
                on update cascade on delete cascade,
  from_stage  text,
  -- Nullable: clearing a stage is still a move, and recording it as nothing would make
  -- the lead look as though it never left where it was.
  to_stage    text,
  -- DENORMALISED on purpose. This is who owned the lead AT THE TIME. Reading sale_id off
  -- the lead instead would rewrite history the moment it is reassigned — last month's
  -- work would silently move to the new owner's scoreboard.
  sale_id     text,
  changed_by  text,
  -- The one-off row written for a lead that already existed when this log was created.
  -- It records no real movement; counting it would show 1,058 phantom moves on whatever
  -- stage each lead happened to be sitting on.
  baseline    boolean not null default false,
  at          timestamptz not null default now()
);

create index lead_stage_event_sale_at_idx on public.lead_stage_event (sale_id, at desc);
create index lead_stage_event_lead_at_idx on public.lead_stage_event (lead_id, at desc);

comment on table public.lead_stage_event is
  'ประวัติการเปลี่ยนขั้นตอนของลีด — append-only, written by trg_lead_stage_change. sale_id is the owner AT THE TIME, not the current one.';

alter table public.lead_stage_event enable row level security;

-- SELECT mirrors main_6_buyer_crm's own policy: if you may see the lead, you may see
-- where it has been. Anything looser would leak the shape of colleagues' pipelines.
create policy p_select on public.lead_stage_event for select
  using (
    (select has_perm('leads.view_all'))
    or ((select has_perm('leads.view_own')) and sale_id = (select current_employee_code()))
  );

-- No INSERT / UPDATE / DELETE policy, deliberately. The log is append-only and the only
-- writer is the SECURITY DEFINER trigger below. A history anyone can edit is not one.

create or replace function public.log_lead_stage_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.pipeline_stage is distinct from old.pipeline_stage then
    insert into public.lead_stage_event (lead_id, from_stage, to_stage, sale_id, changed_by)
    values (new.lead_id, old.pipeline_stage, new.pipeline_stage, new.sale_id,
            (select current_employee_code()));
  end if;
  return new;
end
$$;

create trigger trg_lead_stage_change
  after update of pipeline_stage on public.main_6_buyer_crm
  for each row execute function public.log_lead_stage_change();;
