# Schema tracking

The database schema is tracked here. `supabase/migrations/` holds all 95
migrations, fetched from the remote history table on 2026-09-17 with
`supabase migration fetch` — so the repo and the database agree, and the
database can be rebuilt from this repo.

## Day to day

```bash
supabase migration new <name>   # write a new migration
supabase db push                # apply it to the linked project
supabase migration list         # compare local files against remote history
```

Changes made outside a migration file — in the dashboard, the SQL editor or
through an MCP `apply_migration` — land in the remote history but not on disk.
Run `supabase migration fetch` afterwards to bring the file down, and commit it.
`supabase migration list` is what tells you the two have drifted.

## ⚠️ Never run `migration repair --status reverted` to clear a mismatch

`db pull` suggests it, one line per migration, whenever local files and remote
history differ. It does not fix the difference — it rewrites the REMOTE history
table to claim 95 applied migrations were never applied. That was how this repo
looked before the fetch, and the correct answer was `migration fetch`, not
rewriting the record of what the database has actually run.

## Still worth knowing

- **Migrations are the only schema record, but not the only schema authority.**
  A `create or replace function` in a late migration silently supersedes an
  earlier one. Read the newest file for a given object, not the first.
- **Column-level grants bite.** `main_1_hr`, `action_type` and `kpi_template`
  give `authenticated` per-column privileges, so a new column reads NULL until
  it is granted explicitly. Every migration adding a column to those tables
  needs a matching `grant select (col)`.
- **`DATA_MODEL.md`** still carries the reasoning — what changed and why. The
  migrations carry the what; they do not carry the why.
