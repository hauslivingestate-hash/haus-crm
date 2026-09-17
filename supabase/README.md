# Schema tracking

**Status: scaffolding only. The baseline has not been pulled yet.**

`config.toml` is here and the project is ready to link, but
`supabase/migrations/` does not exist. **The schema still lives only inside
Supabase** — 95 migrations, applied through the dashboard and the MCP. Nothing in
this repo can rebuild the database.

That is fine with one database and one developer. It stops being fine at the
first staging environment, the first other engineer, or the first time somebody
needs to know what the schema looked like last month.

## Finishing it

Three commands, and they need the **company** Supabase account —
`supabase projects list` on this machine is currently signed in to a different
one, which is why this was not completed in the same pass as the code.

```bash
supabase login                                    # the account that owns the project
supabase link --project-ref jpufhxzvqfrdcblfmrmu  # asks for the database password
supabase db pull                                  # writes the baseline
```

`db pull` dumps the whole remote schema to
`supabase/migrations/<timestamp>_remote_schema.sql` and records it as already
applied in the remote history, so a later `db push` will not try to replay it.

⚠️ **Do not hand-write migration files for what is already applied.** The
baseline is a single dump of the current state; individual files recreating
migrations the remote has already run would duplicate it and put local and
remote history out of step. Hand-written migrations start *after* the baseline
exists.

⚠️ **Review the generated file before committing.** `db pull` diffs the remote
against the CLI's default local stack, so the dump can include objects Supabase
manages itself. Read it rather than committing it unseen.

## Until then

[DATA_MODEL.md](../DATA_MODEL.md) is the only record of what changed and why.
Keep adding a dated block there for every schema change, baseline or no baseline.
