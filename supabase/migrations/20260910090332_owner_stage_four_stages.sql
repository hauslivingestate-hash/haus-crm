-- Ben, 2026-09-10: the owner pipeline is four stages, and sold/active/inactive belongs to
-- listing_status, not here.
--
--   New List → Owner Talk → Owner Visit → Exclusive Offer
--
-- My first cut had eight and invented half of them (Sourcing, Appraise, Sold, Dropped).
-- Sold and Dropped were the real mistake: they answer "is this listing live?", which
-- listing_status has always answered. Two columns racing to own one fact is how they end up
-- disagreeing.

-- 1. Renames first, so the FK's ON UPDATE CASCADE carries the listings with them.
--    'Listed' held 408 rows; they become 'New List' without being touched individually.
update public.owner_stage set name = 'New List',       sort_order = 1 where name = 'Listed';
update public.owner_stage set name = 'Exclusive Offer', sort_order = 4 where name = 'Exclusive';
update public.owner_stage set sort_order = 2 where name = 'Owner Talk';
update public.owner_stage set sort_order = 3 where name = 'Owner Visit';

-- 2. Rehome everything on a stage that is about to disappear.
--    The 84 'Sold' and 52 'Dropped' rows go to New List: we obtained every one of these
--    listings, which is what New List means, and whether it later sold or was cancelled is
--    already recorded in listing_status. Nothing is lost — that fact was never stored here
--    in the first place, it was derived from listing_status by my own backfill an hour ago.
update public.main_4_listing_database
set owner_stage = 'New List'
where owner_stage in ('Sourcing', 'Appraise', 'Sold', 'Dropped');

-- 3. Now nothing references them.
delete from public.owner_stage where name in ('Sourcing', 'Appraise', 'Sold', 'Dropped');;
