-- คิวอ่านข้อความด้วย AI — the parse queue.
--
-- ── WHY A ROW AND NOT A PROMISE ─────────────────────────────────────────────────
-- A paste used to be a promise living in the browser tab: the person had to sit in the
-- intake form until it returned, and switching to LINE to copy the next message could kill
-- it outright (mobile Safari suspends backgrounded tabs). Here a paste is a ROW. The server
-- action returns as soon as the row exists and the extraction runs in next/server's
-- `after()`, so the work finishes whether or not anyone is still looking at it — and the
-- draft is waiting on any page, any device, after any refresh.
--
-- ── WHY NO SERVICE-ROLE KEY ─────────────────────────────────────────────────────
-- The `after()` callback runs inside a Server Function, where Next.js still exposes
-- `cookies()`. The runner therefore writes back through the ordinary session client and
-- these policies apply to it exactly as they do to the request that queued the job. Nothing
-- here ever runs with RLS off.
--
-- Rows are never deleted: `consumed_at` hides a job from the tray and `outcome` records
-- whether the draft became a real record. That difference is the only honest read on
-- whether the extractor is good enough, so it is stored rather than thrown away.
create table if not exists public.ai_job (
  id            bigint generated always as identity primary key,
  -- Whose tray this belongs to. Defaulted rather than sent by the client, so a job can
  -- never be filed under someone else even if the action is called directly.
  employee_code text        not null default current_employee_code()
                            references public.main_1_hr(employee_code) on update cascade,
  kind          text        not null check (kind in ('lead', 'listing')),
  status        text        not null default 'queued'
                            check (status in ('queued', 'running', 'done', 'error')),
  raw_text      text        not null,
  -- The extracted draft, shaped by lib/ai/types.ts. jsonb rather than columns: this is a
  -- PROPOSAL awaiting review, not a record — it has no integrity to enforce, and the two
  -- kinds have entirely different shapes.
  draft         jsonb,
  note          text,
  error         text,
  title         text,
  created_at    timestamptz not null default now(),
  -- Restarted by a retry, so the stuck sweep measures the CURRENT attempt.
  started_at    timestamptz,
  finished_at   timestamptz,
  consumed_at   timestamptz,
  outcome       text check (outcome in ('saved', 'discarded'))
);

-- The tray's only query: my unconsumed jobs, newest first.
create index if not exists ai_job_tray_idx
  on public.ai_job (employee_code, consumed_at, created_at desc);

alter table public.ai_job enable row level security;

-- Own rows, always. There is no "view all" scope on purpose: a pasted LINE conversation is
-- raw customer text that nobody else has a reason to read, not even a team lead.
drop policy if exists p_select on public.ai_job;
create policy p_select on public.ai_job for select to authenticated
  using (employee_code = (select current_employee_code()));

-- Queuing a parse spends the company's OpenAI budget, so INSERT is gated on the permission
-- for that KIND — not merely on being signed in. The two are separate keys because listing
-- parsing and lead parsing are handed to different roles (see ai_parse_permissions).
drop policy if exists p_insert on public.ai_job;
create policy p_insert on public.ai_job for insert to authenticated
  with check (
    employee_code = (select current_employee_code())
    and case kind
      when 'lead'    then (select has_perm('ai.parse_lead'))
      when 'listing' then (select has_perm('ai.parse_listing'))
      else false
    end
  );

-- UPDATE covers three things, all of them own-row: the runner writing the result back,
-- a retry, and consuming a job out of the tray. No permission check — a person who can see
-- the row is the only one who can act on it, and re-queuing is re-gated in the action.
drop policy if exists p_update on public.ai_job;
create policy p_update on public.ai_job for update to authenticated
  using (employee_code = (select current_employee_code()))
  with check (employee_code = (select current_employee_code()));

-- No DELETE policy, deliberately: the outcome history is the feature.
grant select, insert, update on public.ai_job to authenticated;;
