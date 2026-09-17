-- `kpi_template` becomes the ONE list of what the company's KPIs are.
--
-- It already held the metric definitions a manager picks from when assigning targets.
-- These columns let the same rows drive the ทีม tab's KPI tracker, so the tracker, the
-- target picker and (later) any report all read one list. HAUS V2 learned this the hard
-- way: its lib/kpi-defs.js exists because the same four KPIs had been hard-coded in three
-- places and had started to drift. We already had three lists heading the same way.
alter table public.kpi_template
  -- 'count' = done vs a CEO-set target. 'pct' = a share of a population, where the target
  -- is always 100% and there is nothing for the CEO to set.
  add column if not exists shape text not null default 'count',
  -- 1–4, the week of the month this KPI is the team's focus. NULL = no rhythm.
  add column if not exists focus_week integer,
  -- Whether this row appears on the ทีม tab's KPI card. Off by default so adding a target
  -- preset never silently changes what the whole team is scored on in public.
  add column if not exists on_tracker boolean not null default false,
  -- For shape='pct': WHICH population share. Not a free metric — each one needs its own
  -- query, so the set is closed and a new one is a code change by definition.
  add column if not exists pct_metric text,
  -- For a count KPI scored off a pipeline rather than an action.
  add column if not exists stage_name text
    references public.pipeline_stage(name) on update cascade on delete set null,
  add column if not exists owner_stage_name text
    references public.owner_stage(name) on update cascade on delete set null;

alter table public.kpi_template
  drop constraint if exists kpi_template_shape_check,
  drop constraint if exists kpi_template_focus_week_check,
  drop constraint if exists kpi_template_pct_metric_check,
  drop constraint if exists kpi_template_shape_coherent;

alter table public.kpi_template
  add constraint kpi_template_shape_check check (shape in ('count', 'pct')),
  add constraint kpi_template_focus_week_check check (focus_week is null or focus_week between 1 and 4),
  add constraint kpi_template_pct_metric_check check (pct_metric is null or pct_metric in ('owner_talk', 'buyer_follow')),
  -- A pct row without a population is unscoreable; a count row with one is ambiguous.
  -- Refused here rather than handled in the card, so no render has to guess.
  add constraint kpi_template_shape_coherent check (
    (shape = 'pct'   and pct_metric is not null) or
    (shape = 'count' and pct_metric is null)
  );

-- ⚠️ COLUMN-LEVEL GRANTS. `authenticated` holds per-column privileges on this table, so a
-- new column is invisible (reads NULL) until it is granted explicitly. This has bitten
-- this project twice — once on main_1_hr.avatar_path, once nearly here.
grant select (shape, focus_week, on_tracker, pct_metric, stage_name, owner_stage_name),
      insert (shape, focus_week, on_tracker, pct_metric, stage_name, owner_stage_name),
      update (shape, focus_week, on_tracker, pct_metric, stage_name, owner_stage_name)
  on public.kpi_template to authenticated;;
