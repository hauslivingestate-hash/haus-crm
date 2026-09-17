-- Removes the demo activity seeded for the ทีม tab's กิจกรรมรายวัน card.
--
-- ⚠️ THE REMARK IS THE ONLY HANDLE. Every seeded row was written with
-- remark = '[SEED] demo activity', and the marker was verified unused before the seed ran
-- (0 matching rows). These activities sit against REAL employees, so nothing else
-- distinguishes them from work the team actually logged — do not edit their remark.
--
-- Safe to run more than once. Deletes nothing else: no employee, task or case is touched.
begin;

-- Look before you delete.
select employee_code, count(*) as rows, sum(count) as activities,
       min(activity_date) as first_day, max(activity_date) as last_day
from activities
where remark like '[SEED]%'
group by employee_code
order by employee_code;

delete from activities where remark like '[SEED]%';

-- Must return 0.
select count(*) as seed_rows_left from activities where remark like '[SEED]%';

commit;
