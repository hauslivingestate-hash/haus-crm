-- ⚠️ main_1_hr does NOT have a table-wide select grant: table `select` was revoked from
-- anon/authenticated on 2026-08-03 and granted back column by column, so that salary and
-- PII can only be read through v_employee_private.
--
-- A column ADDED after that is therefore not readable by anyone — and because PostgREST
-- fails the whole select, adding probation_start/probation_passed_at in the previous
-- migration broke every query that touches the table: /team, /new-sales and the settings
-- page all returned "permission denied for table main_1_hr".
--
-- Any future column on this table needs its own grant. There is no default to inherit.
grant select (probation_start, probation_passed_at) on main_1_hr to authenticated;
grant update (probation_start, probation_passed_at) on main_1_hr to authenticated;;
