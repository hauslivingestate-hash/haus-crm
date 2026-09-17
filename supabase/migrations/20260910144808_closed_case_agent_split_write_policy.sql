-- ปิดช่องโหว่: every agent could read every colleague's commission split.
--
-- p_write was declared FOR ALL. In Postgres a FOR ALL policy's USING clause applies to
-- SELECT as well, so anyone holding leads.edit — every sale — passed it and saw all 60
-- credit rows: who was on which deal and for how much. Proven as S-004 on 2026-09-10
-- (51 rows that were not theirs). The read rule in p_select was correct; it was simply
-- OR'd with a write rule that never meant to grant reads.
--
-- Three separate write policies, none of which touch SELECT.
drop policy if exists p_write on public.closed_case_agent;

create policy p_insert on public.closed_case_agent for insert with check (
  (select has_perm('leads.edit')) or (select has_perm('leads.assign')) or (select has_perm('roles.manage'))
);

create policy p_update on public.closed_case_agent for update using (
  (select has_perm('leads.edit')) or (select has_perm('leads.assign')) or (select has_perm('roles.manage'))
);

create policy p_delete on public.closed_case_agent for delete using (
  (select has_perm('leads.edit')) or (select has_perm('leads.assign')) or (select has_perm('roles.manage'))
);;
