-- ราคาปิด — the price the unit ACTUALLY sold for.
--
-- Ben, 2026-09-06: "the closing price might not be the same as the asking price".
-- Until now the database stored the commission but never the number it was taken
-- from, so every sale price in the company was a guess: commission ÷ ~3%, which
-- lands within a few hundred thousand baht and is not a figure anyone can quote.
--
-- WHY HERE AND NOT main_7_last_match. lib/mutations/lastMatch.ts records the plan to
-- keep the closing price in `main_7_last_match.last_match_price`. That table turned
-- out to be a MARKET LOG, not a sales ledger — only 16 of its 56 rows are this
-- company's own deals; the rest are other agencies' sales recorded for comparison.
-- Putting our revenue there would mix our money with the market's. The deal lives in
-- main_6_buyer_crm next to its commission and its two dates, so the price lives here.
alter table main_6_buyer_crm
  add column if not exists closing_price numeric;

comment on column main_6_buyer_crm.closing_price is
  'ราคาปิดจริง (บาท) — what the unit sold for, which is usually below the listing''s asking_price. Entered by the sale who closed it; nothing else in the database records this number.';
;
