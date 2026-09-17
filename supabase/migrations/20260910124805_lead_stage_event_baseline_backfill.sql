-- One baseline row per lead that already has a stage: where each lead stood the moment
-- the log started. Marked baseline=true so the pipeline card can exclude them — they
-- record no movement, and counting them would report a thousand moves that never
-- happened on whatever day this ran.
--
-- Dated `date_received` rather than now(), so a baseline never lands inside the current
-- window and inflates "this month". Falls back to now() only where the lead carries no
-- received date.
insert into public.lead_stage_event (lead_id, from_stage, to_stage, sale_id, changed_by, baseline, at)
select
  c.lead_id,
  null,
  c.pipeline_stage,
  c.sale_id,
  null,
  true,
  coalesce(c.date_received::timestamptz, now())
from public.main_6_buyer_crm c
where c.pipeline_stage is not null
  and not exists (select 1 from public.lead_stage_event e where e.lead_id = c.lead_id);;
