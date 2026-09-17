-- Lead-attached activity is shared context, not private KPI.
--
-- `activities` began as a personal tally: p_select lets you read your OWN rows, plus your
-- team's with performance.view_team. Correct while every row was "I did 3 viewings on
-- Tuesday" and nothing pointed at a customer.
--
-- The lead drawer's activity log changed what the table holds. A follow-up note written
-- against a lead is the record of that customer's history, and under the old rule the next
-- agent to open the lead could not see it — nor could the Admin role, which handles leads
-- and has neither activity.log nor performance.view_team. A shared log nobody shares is
-- just a private notepad with extra steps.
--
-- Policies are OR'd, so this ADDS visibility and removes none. Two deliberate limits:
--
--   related_lead_id is not null  — daily KPI tallies carry no lead and stay private under
--                                  the existing rule. Only rows about a customer open up.
--   the EXISTS subquery          — is itself evaluated under main_6_buyer_crm's own RLS,
--                                  so "can you see this activity" resolves to exactly
--                                  "can you see this lead" (leads.view_all, or
--                                  leads.view_own on a lead assigned to you). The rule
--                                  cannot drift from the leads rule because it IS it.
--
-- Reads stay cheap: idx_activities_lead covers related_lead_id and lead_id is the PK.
create policy p_select_lead_activity on public.activities
  for select
  using (
    related_lead_id is not null
    and exists (
      select 1
      from public.main_6_buyer_crm c
      where c.lead_id = activities.related_lead_id
    )
  );;
