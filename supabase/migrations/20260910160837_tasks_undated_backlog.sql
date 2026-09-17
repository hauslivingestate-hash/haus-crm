/* รายการรอ — the undated backlog.
   
   A task with no date is something you have decided to do and not decided when. Until now
   `task_date` was NOT NULL, so the only way to capture one was to pick a day you did not
   mean — which is how a plan fills with things nobody intends to do today, and how the
   completion ring stops meaning anything.
   
   ── WHY NULL AND NOT A SEPARATE TABLE ────────────────────────────────────────────
   A backlog item becomes a plan task by being given a date, and nothing else about it
   changes: same title, same type, same linked lead, same activity that fires when it is
   ticked. A second table would have made that a copy-and-delete across two shapes, with
   two sets of RLS and two audit trails, so that a task could cross between them and lose
   its history. It is one row that gains a date.
   
   ── EVERYTHING THAT FILTERS BY DATE ALREADY EXCLUDES IT ──────────────────────────
   `gte`/`lte` on a NULL never matches, so a backlog row cannot appear in a day, a month,
   or the calendar by accident. The plan reads are unchanged; the backlog is read by
   asking for `task_date is null` on purpose. */
alter table tasks alter column task_date drop not null;

comment on column tasks.task_date is
  'The day this task is planned for. NULL = รายการรอ, captured but not yet scheduled; it appears in the backlog card and nowhere else until somebody gives it a date.';

-- The backlog is read as its own list on every plan render, and it is a tiny slice of the
-- table. A partial index keeps that read off a sequential scan as `tasks` grows.
create index tasks_backlog on tasks (employee_code, sort_order) where task_date is null;;
