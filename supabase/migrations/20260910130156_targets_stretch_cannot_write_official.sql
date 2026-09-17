-- ปิดช่องโหว่: a sale could set their own OFFICIAL target.
--
-- The three write policies each allowed `targets.stretch` holders to write any row whose
-- employee_code is their own — WITHOUT checking `owner`. Every sale holds targets.stretch
-- (it is what lets them add a personal goal), so any agent could insert, edit or delete an
-- `owner = 'official'` row for themselves: set the month's revenue target to ฿1 and the
-- dashboard reads 100%. Proven against this database on 2026-09-10 as S-004.
--
-- lib/mutations/targets.ts refuses it, but a server action is not the boundary — anyone
-- can call PostgREST directly with the publishable key. The rule has to live here.
--
-- The split is now explicit: `targets.stretch` writes ONLY your own stretch rows,
-- `targets.set` writes official rows for anyone you can see. Ben, 2026-09-10: the CEO sets
-- the sale's target, not the sale.
drop policy if exists p_insert on public.targets;
create policy p_insert on public.targets for insert
  with check (
    (select has_perm('roles.manage'))
    or (
      owner = 'stretch'
      and (select has_perm('targets.stretch'))
      and employee_code = (select current_employee_code())
    )
    or (
      owner = 'official'
      and (select has_perm('targets.set'))
      and employee_code in (select visible_employee_codes())
    )
  );

drop policy if exists p_update on public.targets;
create policy p_update on public.targets for update
  using (
    (select has_perm('roles.manage'))
    or (
      owner = 'stretch'
      and (select has_perm('targets.stretch'))
      and employee_code = (select current_employee_code())
    )
    or (
      owner = 'official'
      and (select has_perm('targets.set'))
      and employee_code in (select visible_employee_codes())
    )
  );

drop policy if exists p_delete on public.targets;
create policy p_delete on public.targets for delete
  using (
    (select has_perm('roles.manage'))
    or (
      owner = 'stretch'
      and (select has_perm('targets.stretch'))
      and employee_code = (select current_employee_code())
    )
    or (
      owner = 'official'
      and (select has_perm('targets.set'))
      and employee_code in (select visible_employee_codes())
    )
  );;
