-- Condemn abandoned parses, so a dead function shows as a retryable failure rather than a
-- spinner that never stops.
--
-- ── WHY A FUNCTION AND NOT A POSTGREST FILTER ───────────────────────────────────
-- Two reasons, and the second is the real one:
--
--   1. The window is evaluated by POSTGRES. "Now" then means one thing — the database's
--      clock — rather than whatever the serverless region thinks the time is.
--   2. The age is measured from `coalesce(started_at, created_at)`, i.e. from the last time
--      the job entered the queue and not from when it was first pasted. Without that, a
--      retry of an old row is condemned the instant it is queued and nothing ever succeeds
--      twice. PostgREST cannot express a coalesce in a filter, so this is the only place
--      the rule can be stated correctly.
--
-- Three minutes is generous next to a ~4s parse: a slow OpenAI response must never be
-- mistaken for a dead one.
--
-- SECURITY INVOKER, and it STILL filters on current_employee_code() — RLS is a ceiling, not
-- a filter, and every dash_* function in this schema follows the same rule.
create or replace function public.ai_job_sweep()
returns integer
language sql
volatile
security invoker
set search_path to 'public'
as $function$
  with swept as (
    update public.ai_job
       set status      = 'error',
           error       = 'ระบบหยุดกลางคัน — กดลองใหม่ได้',
           finished_at = now()
     where employee_code = current_employee_code()
       and consumed_at is null
       and status in ('queued', 'running')
       and coalesce(started_at, created_at) < now() - interval '3 minutes'
    returning 1
  )
  select count(*)::int from swept;
$function$;

revoke all on function public.ai_job_sweep() from public;
grant execute on function public.ai_job_sweep() to authenticated;;
