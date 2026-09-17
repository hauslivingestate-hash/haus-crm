-- ═══════════════════════════════════════════════════════════════════════════
-- UNSEED — removes everything scripts/seed-new-sales.sql created.
--
-- One statement is enough: activities.employee_code is ON DELETE CASCADE, so
-- the three fake employees take their whole activity log with them.
--
-- The `SEED-%` prefix cannot match a real employee — every real code is
-- C- / E- / S- / SP-, and set_hr_employee_code() can only ever mint those.
--
-- If this ERRORS with a foreign-key violation, that is the safety net working:
-- something real was assigned to a seed employee (a lead, a listing, a closed
-- case — those FKs are RESTRICT, not CASCADE). Reassign it to a real person
-- first, then re-run. It will never silently null out real data.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
delete from main_1_hr where employee_code like 'SEED-%';
commit;
