/* Ben, 2026-09-10: remove บันทึก from the app.

   It was the "free note" action — a way to log a remark against a lead or a listing
   without claiming any work had been done. Nobody ever used it: zero rows in `activities`
   across the whole history, and nothing in tasks, targets, rank_criterion, kpi_template
   or user_quick_actions points at it.

   Its only trace in the code was a constant whose entire job was to HIDE it from the two
   pickers where it made no sense (the probation rank editor and the KPI templates). An
   action type that every picker has to special-case, and that nobody logs, is a category
   the product does not have — notes already live on the lead and listing records.

   The FK from activities.action would refuse this delete if a single row existed, which
   is the check doing its job rather than a risk being taken. */
delete from action_type where name = 'บันทึก';;
