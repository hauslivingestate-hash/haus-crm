-- Which lead statuses may be counted as revenue.
--
-- THE BUG THIS PREVENTS, measured in this database today: 16 leads carry a commission.
-- Fourteen are Win (฿3,400,200). One is Lose and one is Reject, each carrying ฿150,000 —
-- money that was entered and then the case died. Summing commission without this flag
-- reports ฿3,700,200 against a truth of ฿3,400,200: 8.8% of phantom revenue, permanently,
-- and growing every time a deal falls through after the numbers were filled in.
--
-- A COLUMN, NOT A LIST IN THE CODE. `lead_status` is editable in ตั้งค่า. A hardcoded
-- ('Lose','Reject') in TypeScript would be wrong the day someone adds "ยกเลิกสัญญา", and
-- wrong silently — in the direction that overstates income.
--
-- DEFAULT TRUE, deliberately. A status nobody has classified counts, so newly added
-- statuses cannot make real revenue vanish from a scoreboard. The opposite default hides
-- money, which is the harder error to notice.
--
-- ⚠️ NOT YET EDITABLE IN ตั้งค่า — the Settings toggle is not built. Until it is, changing
-- this is a one-line SQL update.
alter table public.lead_status
  add column if not exists counts_as_revenue boolean not null default true;

update public.lead_status set counts_as_revenue = false where name in ('Lose', 'Reject');

comment on column public.lead_status.counts_as_revenue is
  'false = a lead at this status is never revenue, whatever money is recorded on it. Lose/Reject seeded false. See แดชบอร์ดขาย.';;
