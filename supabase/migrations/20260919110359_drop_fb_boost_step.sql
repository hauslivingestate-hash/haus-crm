-- Ben, 2026-09-19: "เอาบูสต์ออกเลยจากทุกหน้า". The step came from the Listing Support
-- sheet's group_boost_date column, which was never filled; nobody ticked it in the web app
-- either (0 progress rows). Removing the template item takes it off the listing checklist
-- card as well as the Facebook Post board. Progress rows would cascade; there are none.
delete from public.checklist_template_item where board_key = 'fb_boost';

-- Close up the gap in the A-List posting template's order.
update public.checklist_template_item i set sort = i.sort - 1
from public.checklist_template t
where t.id = i.template_id and t.name = 'ลงประกาศ A List' and i.sort > 6;
