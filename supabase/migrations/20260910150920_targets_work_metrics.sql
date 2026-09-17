-- ความเคลื่อนไหว, step 4: goals on the work rows, not just on revenue.
--
-- ── WHY A COLUMN AND NOT A STRING ───────────────────────────────────────────────
-- Klaichan CRM keys these off a free-text `targets.metric` ('stage:Call', 'kind:Survey').
-- That cannot work here: our stages are editable in ตั้งค่า, and renaming Call would
-- leave 'stage:Call' pointing at nothing — a goal that silently stops being read, which
-- is worse than one that errors. A real FK with ON UPDATE CASCADE carries the goal with
-- the rename.
alter table targets
  add column stage_name text
    references pipeline_stage(name) on update cascade on delete cascade;

comment on column targets.stage_name is
  'Which buyer pipeline step this goal scores, for source = ''stage''. The dashboard sums every action whose action_type.stage_name matches. NULL for every other source.';

-- Two new sources. `stage` = a goal on a funnel step; `listing` = ทรัพย์ใหม่, which is
-- counted from main_4_listing_database and is deliberately NOT an activity (a listing
-- already carries its own dated row — logging it twice would double-count it).
alter table targets drop constraint targets_source_check;
alter table targets add constraint targets_source_check
  check (source in ('activity', 'pipeline', 'manual', 'kpi', 'revenue', 'stage', 'listing'));

-- Each source populates exactly the column it is scored on. Without this a 'stage' goal
-- with no stage_name would read as a goal on nothing and draw as 0.
alter table targets add constraint targets_metric_matches_source check (
  case source
    when 'stage'   then stage_name is not null
    when 'listing' then stage_name is null and activity_type is null
    else stage_name is null
  end
);

/* ── ONE ROW PER METRIC PER PERIOD ────────────────────────────────────────────────
   Scoped to `month is null`, which is what separates the two families of target rows:

     month IS NULL   period-based, set by leadership, read by the dashboard
     month = 'YYYY-MM'  the แผนวันนี้ goal board, where two goals may legitimately share
                        an action ("โทร 20 สาย" and "โทรลูกค้าเก่า 5 สาย")

   Without the scope this index would forbid that second case. With it, a double save on
   the dashboard editor still cannot become two rows the card would silently sum. */
create unique index targets_one_per_work_metric on targets (
  employee_code, owner, period, period_key, source,
  coalesce(activity_type, ''), coalesce(stage_name, '')
) where month is null and source in ('activity', 'stage', 'listing');;
