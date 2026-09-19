-- หน้า Facebook Post ของโต๊ะงาน Support (Ben, 2026-09-19).
--
-- The board's columns are checklist steps of the "ลงประกาศ A List" template, so a tick on
-- the board and a tick on the listing's checklist card are the same row. Ben approved
-- reshaping the template for it: split "Facebook Profile / เพจ" into two steps and add a
-- "Template Link" step. Nothing was ticked yet (listing_checklist_item had 0 rows).

-- 1. A stable key per step the board reads. Labels are CEO-editable in Settings; the board
--    must not break the day someone renames "Facebook Page" to "เพจ".
alter table public.checklist_template_item add column if not exists board_key text;
create unique index if not exists uq_checklist_item_board_key
  on public.checklist_template_item (board_key) where board_key is not null;

do $$
declare
  t int;
begin
  select id into t from public.checklist_template where name = 'ลงประกาศ A List';
  if t is null then raise exception 'template "ลงประกาศ A List" not found'; end if;

  update public.checklist_template_item set label = 'Facebook Profile', board_key = 'profile'
   where template_id = t and label = 'Facebook Profile / เพจ';
  update public.checklist_template_item set board_key = 'marketplace'
   where template_id = t and label = 'Facebook Marketplace';
  update public.checklist_template_item set board_key = 'fb_group'
   where template_id = t and label = 'Facebook Group';
  update public.checklist_template_item set board_key = 'fb_boost'
   where template_id = t and label = 'บูสต์โพสต์กลุ่ม';

  insert into public.checklist_template_item (template_id, label, item_type, role, sort, board_key)
  select t, 'Template Link', 'link', 'listing_support', 0, 'template_link'
  where not exists (select 1 from public.checklist_template_item where board_key = 'template_link');
  insert into public.checklist_template_item (template_id, label, item_type, role, sort, board_key)
  select t, 'Facebook Page', 'task', 'listing_support', 0, 'page'
  where not exists (select 1 from public.checklist_template_item where board_key = 'page');

  -- The Facebook steps are Listing Support's job (Ben, 2026-09-19).
  update public.checklist_template_item set role = 'listing_support'
   where template_id = t and board_key in ('marketplace', 'profile', 'page');

  -- Order the template the way the board reads left to right.
  update public.checklist_template_item i set sort = o.sort
  from (values ('template_link', 1), ('marketplace', 2), ('profile', 3), ('page', 4),
               ('fb_group', 5), ('fb_boost', 6)) as o(k, sort)
  where i.board_key = o.k;
  update public.checklist_template_item set sort = 7 where template_id = t and label = 'DDproperty';
  update public.checklist_template_item set sort = 8 where template_id = t and label = 'Livinginsider';
  update public.checklist_template_item set sort = 9 where template_id = t and label = 'PropertyHub';
end $$;

-- 2. Exclusive: the date the post was pinned. Benz fills it in; the board turns it red past
--    85 days. On the listing, like the agreement dates, so it survives the listing dropping
--    out of main_10.
alter table public.main_4_listing_database add column if not exists fb_pinned_on date;

-- 3. Facebook Group posts: five slots per listing, one post every 6 days; the sixth post
--    overwrites the oldest (Ben, 2026-09-19). The checklist's "Facebook Group" step still
--    carries the latest post (date + link) so the listing card stays right; every post is
--    also written to audit_log, so links overwritten here are not lost.
create table if not exists public.listing_fb_group_post (
  listing_id  text not null references public.main_4_listing_database(listing_id)
                on update cascade on delete cascade,
  slot        smallint not null check (slot between 1 and 5),
  url         text not null check (url ~* '^https?://'),
  posted_on   date not null default current_date,
  posted_by   text references public.main_1_hr(employee_code) on update cascade,
  updated_at  timestamptz not null default now(),
  primary key (listing_id, slot)
);

alter table public.listing_fb_group_post enable row level security;
revoke all on public.listing_fb_group_post from anon;

drop policy if exists p_select on public.listing_fb_group_post;
create policy p_select on public.listing_fb_group_post for select to authenticated
  using ((select has_perm('listings.view')));

drop policy if exists p_write on public.listing_fb_group_post;
create policy p_write on public.listing_fb_group_post for all to authenticated
  using ((select has_perm('support.workspace')) or (select has_perm('listings.marketing')) or (select has_perm('roles.manage')))
  with check ((select has_perm('support.workspace')) or (select has_perm('listings.marketing')) or (select has_perm('roles.manage')));
