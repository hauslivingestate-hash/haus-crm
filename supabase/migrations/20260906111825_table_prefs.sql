create table if not exists public.table_prefs (
  employee_code text not null
    references public.main_1_hr (employee_code) on update cascade on delete cascade,
  table_key    text not null,
  column_order jsonb not null default '[]'::jsonb,
  hidden       jsonb not null default '[]'::jsonb,
  updated_at   timestamptz not null default now(),
  primary key (employee_code, table_key)
);

alter table public.table_prefs enable row level security;

grant select, insert, update, delete on public.table_prefs to authenticated;

create policy p_select on public.table_prefs for select to authenticated
  using (employee_code = (select current_employee_code()));

create policy p_insert on public.table_prefs for insert to authenticated
  with check (employee_code = (select current_employee_code()));

create policy p_update on public.table_prefs for update to authenticated
  using      (employee_code = (select current_employee_code()))
  with check (employee_code = (select current_employee_code()));

create policy p_delete on public.table_prefs for delete to authenticated
  using (employee_code = (select current_employee_code()));;
