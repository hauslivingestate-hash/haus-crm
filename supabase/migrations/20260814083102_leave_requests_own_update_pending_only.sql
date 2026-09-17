-- Phase 6 (/leave). The own-row half of p_update carried no status restriction, so an agent
-- could flip their own row to 'approved' straight through the REST API — RLS was the ceiling,
-- and the only thing stopping self-approval was the app-layer check in decideLeave().
-- Narrow it: you may still edit your OWN request, but only while it is undecided, and the
-- `with check` half stops you from making it decided.
alter policy p_update on leave_requests
  using (
    (select has_perm('leave.manage'))
    or (select has_perm('roles.manage'))
    or (employee_code = (select current_employee_code()) and status = 'pending')
  )
  with check (
    (select has_perm('leave.manage'))
    or (select has_perm('roles.manage'))
    or (employee_code = (select current_employee_code()) and status = 'pending')
  );

-- Same reasoning for DELETE: withdrawing after a decision erases the record of that decision.
alter policy p_delete on leave_requests
  using (
    (select has_perm('leave.manage'))
    or (select has_perm('roles.manage'))
    or (employee_code = (select current_employee_code()) and status = 'pending')
  );;
