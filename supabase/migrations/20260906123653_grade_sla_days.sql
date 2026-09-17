-- Follow-up SLA, per grade. Additive: one nullable column on the two grade
-- lookups that already carry `color` and `sort_order`.
--
-- NULL MEANS NO SLA — not "use a default" (Ben, 2026-09-06). Klaichan falls
-- back to a 30-day window when a grade carries none, which means nothing can
-- ever be switched off; an ungraded or administrative grade then nags for ever.
-- Here, a blank box is an explicit "don't chase this grade", and it is the
-- default state so a grade nobody has thought about stays silent rather than
-- inventing a deadline on the team's behalf.
--
-- Deliberately NOT a per-record `next_follow` column. Due is DERIVED from last
-- follow + the grade's window (lib/sla.ts). A stored date would be a second
-- source of truth that could disagree with the badge on its own row — the same
-- reason Klaichan dropped theirs in migration 0046.

alter table public.potential         add column if not exists sla_days int;
alter table public.listing_potential add column if not exists sla_days int;

-- Seeded from the team's own rule, already live as conditional formatting on
-- the Buyer Focus tab of "Stone Haus Living Listing":
--   =AND($D2="A", TODAY() > $M2 + 7)   -> red
--   =AND($D2="B", TODAY() > $M2 + 15)  -> red
-- Every other grade is left NULL = off, because the sheet states no rule for
-- them and guessing one would put red on rows nobody agreed to chase.
update public.potential set sla_days = 7  where name = 'A';
update public.potential set sla_days = 15 where name = 'B';;
