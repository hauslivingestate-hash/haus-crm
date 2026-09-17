-- Let a sale clear the Last Match row their own close created, and nothing else.
--
-- The old rule was roles.manage only. That was right while every row was hand-entered market
-- data, but the closing card now creates rows automatically: an agent records a deal, the
-- buyer pulls out, they reopen the lead — and could not remove the row they had just caused.
-- A market log that says a property sold when it did not is worse than a missing entry, and
-- "ask the admin" is how a wrong row stays for a month.
--
-- The widening is deliberately narrow, and BOTH extra conditions matter:
--   lead_id is not null   → only rows the app created from a lead. The 56 imported rows
--                           stay admin-only; an agent cannot touch the market history.
--   sale_id = them        → only their own. Not a teammate's, whatever they can see.
--
-- roles.manage keeps its unrestricted delete.
drop policy if exists p_delete on public.main_7_last_match;

create policy p_delete on public.main_7_last_match
for delete
using (
  (select has_perm('roles.manage'))
  or (
    lead_id is not null
    and (select has_perm('lastmatch.add'))
    and sale_id = (select current_employee_code())
  )
);;
