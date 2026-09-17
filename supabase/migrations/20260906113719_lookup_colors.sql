-- Colour + explicit ordering for the lookup lists that paint a grid cell.
-- Additive: two nullable columns on five existing tables. No row is rewritten
-- except to seed the colours the app was already hardcoding.
--
-- `color` holds a PALETTE TOKEN ("green", "amber", …), never a hex. globals.css
-- is explicit that components use semantic tokens only, and a free colour
-- picker is how a palette stops being a palette — a CEO can pick a hue that
-- fails contrast in dark mode and nothing would catch it.
-- lib/tables/palette.ts is the authority on which tokens exist.

alter table public.lead_status       add column if not exists color text, add column if not exists sort_order int not null default 0;
alter table public.pipeline_stage    add column if not exists color text, add column if not exists sort_order int not null default 0;
alter table public.potential         add column if not exists color text, add column if not exists sort_order int not null default 0;
alter table public.listing_status    add column if not exists color text, add column if not exists sort_order int not null default 0;
alter table public.listing_potential add column if not exists color text, add column if not exists sort_order int not null default 0;

-- Seeded from what the code already painted, so nothing changes appearance on
-- deploy. pipeline_stage reuses the exact hues lib/pipeline assigns its dots.
update public.pipeline_stage set color = v.color, sort_order = v.ord
from (values ('Lead','blue',1),('Call','teal',2),('Follow','violet',3),('Appoint','violet',4),
             ('Show','amber',5),('Nego','crimson',6),('Close','green',7),('Win','green',8)
     ) as v(name,color,ord) where public.pipeline_stage.name = v.name;

update public.lead_status set color = v.color, sort_order = v.ord
from (values ('Active','blue',1),('Win','green',2),('Lose','red',3),('Reject','slate',4)
     ) as v(name,color,ord) where public.lead_status.name = v.name;

-- 'New Lead' is deliberately left uncoloured: an ungraded lead is the absence
-- of a judgement, and filling it makes "not yet assessed" look like a choice.
update public.potential set color = v.color, sort_order = v.ord
from (values ('A','green',1),('B','blue',2),('C','slate',3),('New Lead',null,4),('Agent','teal',5)
     ) as v(name,color,ord) where public.potential.name = v.name;

update public.listing_status set color = v.color, sort_order = v.ord
from (values ('Posted','green',1),('Ready to Post','blue',2),('Update','amber',3),('Need Info','amber',4),
             ('Sold','green',5),('Sold Completed','green',6),('Cancel','slate',7),('Cancel Completed','slate',8)
     ) as v(name,color,ord) where public.listing_status.name = v.name;

update public.listing_potential set color = v.color, sort_order = v.ord
from (values ('Exclusive','crimson',1),('Exclusive A','crimson',2),('A List','amber',3),
             ('A List + Fb add','amber',4),('Normal','slate',5)
     ) as v(name,color,ord) where public.listing_potential.name = v.name;;
