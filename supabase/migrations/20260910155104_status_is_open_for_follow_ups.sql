/* Which records are still worth chasing.
   
   The follow-up card has to exclude finished business, and until now the only way to say
   so was to name statuses in a query — `lead_status = 'Active'`, hardcoded. Both status
   lists are editable in ตั้งค่า, so a rename would have silently emptied the card or
   silently filled it with sold units, with nothing on screen saying why.
   
   `is_open` is the fact the query actually needs, stored beside the status it describes.
   
   ⚠️ CHANGES NO NUMBER TODAY. For leads, Active is already the only status the card
   accepted. For listings the card did not exist. This is the rule being written down
   rather than the rule changing. */

alter table lead_status add column is_open boolean not null default true;
comment on column lead_status.is_open is
  'Is a lead on this status still being worked? false = finished, so it drops out of follow-up chasing. Separate from counts_as_revenue: a Win is closed but its commission still counts.';
update lead_status set is_open = false where name in ('Win', 'Lose', 'Reject');

alter table listing_status add column is_open boolean not null default true;
comment on column listing_status.is_open is
  'Is a listing on this status still live? false = sold or cancelled, so nobody is chased about it. Need Info / Ready to Post / Posted / Update are all open — a unit that is not advertised yet still has an owner waiting to hear from someone.';
update listing_status set is_open = false where name in ('Sold Completed', 'Cancel Completed');;
