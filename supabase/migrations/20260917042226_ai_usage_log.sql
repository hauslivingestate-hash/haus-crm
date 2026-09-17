-- Token usage per parse — what the AI actually costs.
--
-- Written best-effort by the parse runner and never allowed to fail a parse: a missing
-- usage row costs a line in a report, a thrown one would cost the user their draft.
--
-- Tokens rather than baht. The price per million changes when the model tier changes, and a
-- stored baht figure would silently become a historical fiction the first time it did;
-- lib/ai/extract.ts holds the current rates and the report multiplies at read time.
create table if not exists public.ai_usage (
  id            bigint generated always as identity primary key,
  employee_code text        not null default current_employee_code()
                            references public.main_1_hr(employee_code) on update cascade,
  kind          text        not null check (kind in ('lead', 'listing')),
  model         text        not null,
  input_tokens  integer     not null default 0,
  output_tokens integer     not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists ai_usage_created_idx on public.ai_usage (created_at desc);

alter table public.ai_usage enable row level security;

-- Own spend always; everyone's spend for whoever runs the company. `roles.manage` rather
-- than a new key: this is the same audience that already sees the audit log, and one more
-- permission to explain buys nothing.
drop policy if exists p_select on public.ai_usage;
create policy p_select on public.ai_usage for select to authenticated
  using (
    employee_code = (select current_employee_code())
    or (select has_perm('roles.manage'))
  );

-- No permission check: this row is written by the runner for a job whose INSERT was already
-- gated on ai.parse_*. A second gate here would only add a way for the log to disagree with
-- what actually happened.
drop policy if exists p_insert on public.ai_usage;
create policy p_insert on public.ai_usage for insert to authenticated
  with check (employee_code = (select current_employee_code()));

-- Append-only: no UPDATE, no DELETE. A spend log you can edit is not a spend log.
grant select, insert on public.ai_usage to authenticated;;
