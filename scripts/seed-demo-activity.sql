-- Demo activity for the CURRENT month, so the ทีม tab's กิจกรรมรายวัน heatmap and the
-- category pills have something to draw. Written 2026-09-17 because the real activity log
-- is a frozen sheet import that stops at 2026-08-25, leaving every preset range empty.
--
-- ⚠️ THIS WRITES AGAINST REAL EMPLOYEES. The rows count toward the dashboards, the KPI
-- tallies and the probation ladder until they are removed. Undo with
-- scripts/unseed-demo-activity.sql, which keys on the '[SEED]' remark and nothing else.
--
-- Month-relative (date_trunc + current_date), so it stays calibrated whenever it is run.
-- Re-runnable: the delete at the top clears a previous seed first.
begin;

delete from activities where remark like '[SEED]%';

with team as (
  select employee_code, row_number() over (order by employee_code) as idx
  from main_1_hr where team_id is not null
),
days as (
  select d::date as day
  from generate_series(date_trunc('month', current_date)::date, current_date, interval '1 day') d
),
acts as (
  select name, category from action_type where category is not null and is_active is not false
),
grid as (
  -- hashtext keeps it deterministic: the same seed twice produces the same grid, so a
  -- screenshot taken today still matches the data tomorrow.
  select t.employee_code, t.idx, d.day, a.name, a.category,
         abs(hashtext(t.employee_code || d.day::text || a.name)) % 100 as roll,
         case extract(isodow from d.day) when 6 then 0.30 when 7 then 0.0 else 1.0 end as day_weight
  from team t cross join days d cross join acts a
)
insert into activities (employee_code, action, activity_date, count, remark)
select employee_code, name, day, 1 + (roll % 3), '[SEED] demo activity'
from grid
where roll < day_weight * (
        -- Per-category density, roughly the shape of a real sales month: mostly buyer-side
        -- calls and follows, a weekly meeting at the bottom.
        case category
          when 'ฝั่งผู้ซื้อ'  then 22
          when 'ฝั่งเจ้าของ' then 14
          when 'ธุรการ'     then 10
          when 'สำรวจ'      then 8
          when 'บริษัท'     then 4
          else 0
        end
        -- A per-person tilt so the columns rank differently instead of all sitting level.
        + (6 - least(idx, 6)) * 3
      );

commit;
