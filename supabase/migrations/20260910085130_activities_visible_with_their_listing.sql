-- The listing half of p_select_lead_activity, applied for the same reason and built the
-- same way: an activity attached to a listing is that property's history, and the next
-- agent to open it needs to read what the last one wrote.
--
-- The EXISTS runs under main_4_listing_database's own RLS, so "can you see this activity"
-- resolves to exactly "can you see this listing" and cannot drift from it.
--
-- Additive: policies are OR'd, so personal KPI tallies (no listing attached) stay private
-- under the existing p_select. idx_activities_listing already covers the lookup.
create policy p_select_listing_activity on public.activities
  for select
  using (
    related_listing_id is not null
    and exists (
      select 1
      from public.main_4_listing_database l
      where l.listing_id = activities.related_listing_id
    )
  );;
