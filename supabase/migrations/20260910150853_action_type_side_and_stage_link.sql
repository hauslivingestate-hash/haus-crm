-- ความเคลื่อนไหว, step 2: give an action the two structural facts the dashboard needs.
--
-- WHY NOT REUSE WHAT IS ALREADY THERE:
--   `attach`      = which RECORD an action hangs on (lead / listing / none / either).
--                   Sourcing is attach='none' because there is no listing yet — it is
--                   still property work. So attach cannot say which side of the business
--                   a row belongs to.
--   `group_label` = free text, editable, meant for display. A card that decided the
--                   owner half by matching the string 'งานทรัพย์' would break the day
--                   somebody renames it.
--
-- `side` is the closed set the card can branch on; `group_label` stays the label.
alter table action_type
  add column side text not null default 'general'
    check (side in ('listing', 'lead', 'general'));

comment on column action_type.side is
  'Which half of the business this action belongs to: listing = acquisition (owner side), lead = the buyer pipeline, general = neither. Drives the ฝั่งเจ้าของ / ฝั่งลูกค้า split on the dashboard. NOT the same as `attach`, which says which record the action hangs on — Sourcing is side=listing, attach=none.';

-- Which pipeline step an action ADVANCES. Klaichan CRM matched its two dashboard views
-- by label and had to migrate away from it: the lists "only agreed by coincidence of
-- labels". Ours would agree today (Call/Follow/Appoint/Show/Nego/Close/Win are both
-- action names and stage names) and stop agreeing the moment a stage is renamed in
-- ตั้งค่า. A real FK with ON UPDATE CASCADE cannot drift.
alter table action_type
  add column stage_name text
    references pipeline_stage(name) on update cascade on delete set null;

comment on column action_type.stage_name is
  'The buyer pipeline step this action advances, so งานที่ทำ and กรวยการขาย can be indexed by the same rows. Several actions may point at one step; they sum. NULL = real work that advances no particular step (it shows in the นอกกรวยการขาย footnote).';

alter table action_type
  add column owner_stage_name text
    references owner_stage(name) on update cascade on delete set null;

comment on column action_type.owner_stage_name is
  'The owner pipeline step this action advances. Same idea as stage_name, for the acquisition side.';

-- An action belongs to one side, so it can point at one pipeline, and only the one its
-- side names. Without this a row could claim to advance both.
alter table action_type
  add constraint action_type_stage_matches_side check (
    (stage_name is null or side = 'lead')
    and (owner_stage_name is null or side = 'listing')
  );

/* ---- seed from what the rows already say ---------------------------------------- */

update action_type set side = 'listing' where group_label = 'งานทรัพย์';
update action_type set side = 'lead'    where group_label = 'ไปป์ไลน์ (ลูกค้า)';

-- Sourcing is prospecting for property. It sits in 'ทั่วไป' only because it attaches to
-- no record; the KPI sheet scores it as acquisition work (Sourcing 10/month), and the
-- owner half is where it can be scored. Changeable in ตั้งค่า.
update action_type set side = 'listing' where name = 'Sourcing';

-- Buyer actions named after the step they advance. เซ็นสัญญา is the signing event, which
-- is what Close means in this pipeline (closed_case.closing_date is วันที่เซ็นสัญญา), so
-- it sums into Close alongside the Close action itself.
update action_type a set stage_name = a.name
  where a.side = 'lead' and exists (select 1 from pipeline_stage s where s.name = a.name);
update action_type set stage_name = 'Close' where name = 'เซ็นสัญญา';

update action_type a set owner_stage_name = a.name
  where a.side = 'listing' and exists (select 1 from owner_stage s where s.name = a.name);;
