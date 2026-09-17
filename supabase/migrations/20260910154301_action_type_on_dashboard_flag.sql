/* Ben, 2026-09-10: "if there's an action on our app then keep it.. but I think it's not
   important enough to be on the dashboard."

   ประชุม, ทำงานหน้าคอม and อื่นๆ carry 286 logged activities by six people over nine
   months. They are real work and they stay loggable — deleting them would have taken the
   history with them and stopped every past report reconciling with the app. They just do
   not belong on a scoreboard.

   ── WHY A NEW COLUMN AND NOT `side` ──────────────────────────────────────────────
   `side` answers "which half of the business" — these are `general`, and so are Survey,
   โอน and ถ่ายรูป, which Ben DOES want on the card. The two facts are independent:

     side          where a row is drawn      listing / lead / general
     on_dashboard  whether it is drawn       true / false

   Overloading `side` with a fourth value like 'admin' would have made a placement column
   answer a scoring question, and the next action that is both admin work and property
   work would have had nowhere to sit. */
alter table action_type
  add column on_dashboard boolean not null default true;

comment on column action_type.on_dashboard is
  'Does this action appear on the ความเคลื่อนไหว dashboard card? false = admin work that is still logged, still in history, still usable in tasks and KPI templates — just not scored on the dashboard. Independent of `side`, which decides WHERE a shown row is drawn.';

update action_type set on_dashboard = false
  where name in ('ประชุม', 'ทำงานหน้าคอม', 'อื่นๆ');;
