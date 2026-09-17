-- ═══════════════════════════════════════════════════════════════════════════
-- SEED — เซลล์ใหม่ (probation) board demo data
--
-- WHY THIS EXISTS: every real employee was marked as having passed probation on
-- 2026-08-14 (the programme starts from zero), so /new-sales renders an empty
-- board and there is no way to see it work. This puts three fictional sales on
-- it at three different rungs of the live ladder.
--
-- ⚠️ THIS WRITES TO THE PRODUCTION DATABASE. There is no staging project.
--    Undo with scripts/unseed-new-sales.sql — it removes exactly what this adds.
--
-- ⚠️ THESE ARE NOT REAL PEOPLE. Codes are SEED-001..003 rather than S-006..008
--    on purpose: the app shows the code next to every name, `SEED` never
--    collides with the S-series counter in set_hr_employee_code(), and cleanup
--    can match on the prefix with no chance of catching a real row.
--
-- SIDE EFFECTS, all reversed by the unseed script:
--   • the three appear on the ทีม roster, in ผู้ดูแล pickers and in any
--     company-wide activity count — action_type.on_dashboard is true for all
--     five actions used here, so dashboard/KPI activity totals rise.
--   • they carry no login, no role and no team, so the new "ยังตั้งค่าไม่ครบ"
--     pill flags all three. That is correct, and doubles as a demo of it.
--   • team_id is left NULL deliberately: it keeps them out of team revenue
--     aggregates, which is the pollution that would be hardest to eyeball.
--
-- Safe to re-run: it deletes its own rows first.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- Idempotency. Only ever matches SEED-%; activities cascade (see the FK).
delete from main_1_hr where employee_code like 'SEED-%';

-- ── The three ──────────────────────────────────────────────────────────────
-- Dates are relative to the month this is run in, not hard-coded, so the board
-- stays calibrated whenever it is run. probation_start sits 75 days before the
-- start of the current month — comfortably before the earliest activity below.
insert into main_1_hr (
  employee_code, nickname, first_name_th, last_name_th,
  second_position, status, date_started, probation_start, probation_passed_at, remark
)
select code, nickname, first_th, last_th,
       'Sales', 'Active',
       date_trunc('month', current_date)::date - 75,
       date_trunc('month', current_date)::date - 75,
       null,
       'SEED · ข้อมูลทดสอบ เซลล์ใหม่ — ลบด้วย scripts/unseed-new-sales.sql'
from (values
  ('SEED-001', 'ต้นกล้า', 'ต้นกล้า', 'ทดสอบระบบ'),
  ('SEED-002', 'ปันปัน',  'ปัณณธร', 'ทดสอบระบบ'),
  ('SEED-003', 'กฤต',    'กฤตเมธ', 'ทดสอบระบบ')
) as v(code, nickname, first_th, last_th);

-- ── Their activity log ─────────────────────────────────────────────────────
-- Calibrated against the live ladder in probation_rank / rank_criterion:
--   Rookie = Call 20 total   + Survey 5 total
--   Junior = Call 30 MONTHLY + Show 5 total + Owner Visit 4 total
--   Senior = Show 10 total   + Win 1 total
--
-- Result: SEED-003 holds Junior, SEED-002 holds Rookie, SEED-001 is เริ่มต้น —
-- three distinct rungs, each with a part-filled ring toward the next.
--
-- `month_day` rows land in the CURRENT month (what a `monthly` criterion counts)
-- and are clamped to today so a run on the 1st cannot post-date anything.
-- `back_day` rows are counted back from the start of this month, i.e. earlier
-- months — they feed `total` only.
insert into activities (employee_code, action, activity_date, count, remark)
select code, action,
       case when month_day is not null
            then least(date_trunc('month', current_date)::date + month_day, current_date)
            else date_trunc('month', current_date)::date - back_day
       end,
       n,
       'SEED · ข้อมูลทดสอบ'
from (values
  -- SEED-001 → เริ่มต้น: Call 12/20, Survey 2/5. Rookie half-filled.
  ('SEED-001', 'Call',        null::int, 40,   3),
  ('SEED-001', 'Call',        null,      12,   4),
  ('SEED-001', 'Call',        2,         null, 5),
  ('SEED-001', 'Survey',      null,      20,   1),
  ('SEED-001', 'Survey',      8,         null, 1),

  -- SEED-002 → Rookie: Call 24 total ✓, Survey 6 ✓. Junior blocked on Call
  -- monthly (11/30), so the ring shows real progress rather than 0 or 100.
  ('SEED-002', 'Call',        null,      55,   6),
  ('SEED-002', 'Call',        null,      41,   3),
  ('SEED-002', 'Call',        null,      10,   4),
  ('SEED-002', 'Call',        3,         null, 6),
  ('SEED-002', 'Call',        10,        null, 5),
  ('SEED-002', 'Survey',      null,      50,   2),
  ('SEED-002', 'Survey',      null,      6,    2),
  ('SEED-002', 'Survey',      7,         null, 2),
  ('SEED-002', 'Show',        null,      13,   1),
  ('SEED-002', 'Show',        1,         null, 2),
  ('SEED-002', 'Owner Visit', null,      8,    1),
  ('SEED-002', 'Owner Visit', 9,         null, 1),

  -- SEED-003 → Junior: Call 58 total / 34 this month ✓, Survey 9 ✓, Show 7 ✓,
  -- Owner Visit 5 ✓. Senior blocked on Show (7/10) and Win (0/1).
  ('SEED-003', 'Call',        null,      58,   8),
  ('SEED-003', 'Call',        null,      44,   7),
  ('SEED-003', 'Call',        null,      9,    9),
  ('SEED-003', 'Call',        1,         null, 12),
  ('SEED-003', 'Call',        8,         null, 11),
  ('SEED-003', 'Call',        14,        null, 11),
  ('SEED-003', 'Survey',      null,      53,   3),
  ('SEED-003', 'Survey',      null,      5,    3),
  ('SEED-003', 'Survey',      4,         null, 3),
  ('SEED-003', 'Show',        null,      36,   2),
  ('SEED-003', 'Show',        null,      7,    2),
  ('SEED-003', 'Show',        7,         null, 3),
  ('SEED-003', 'Owner Visit', null,      49,   2),
  ('SEED-003', 'Owner Visit', null,      4,    2),
  ('SEED-003', 'Owner Visit', 11,        null, 1)
) as v(code, action, month_day, back_day, n);

commit;

-- Verify: expect กฤต = Junior, ปันปัน = Rookie, ต้นกล้า = เริ่มต้น.
-- select employee_code, action, sum(count) from activities
--   where remark like 'SEED%' group by 1,2 order by 1,2;
