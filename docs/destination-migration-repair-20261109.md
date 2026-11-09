# Destination migration history repair — 2026-11-09

The active supabase/migrations directory now mirrors all 40 migrations recorded by destination project ayrryemawwplguaauxij. The SQL was recovered from its applied migration history, not reconstructed from names. Existing unrelated/legacy migrations are preserved byte-for-byte in supabase/archive/legacy-migrations, outside the automatic migration scan. Historical tests point to that archive.

No production schema or migration-history rows were edited. Do not use migration repair, reset, or replay archived SQL on production. The hash manifest protects recovered applied SQL from accidental changes; future changes belong in new migrations.

The report-settings table and planned_subject_name column already exist in production with RLS enabled. The previous repository-only assessment could not establish that; direct database inspection now confirms them.

## Verification

- All 40 destination versions represented, no duplicate or extra versions in the active directory.
- New regression checks verify immutable recovered migration hashes and optional feedback payload. Blank feedback must be an empty string because noor_assessment_results.feedback is NOT NULL.
- A rollback-only live transaction tested an isolated second-school fixture: cross-school settings/marks access rejected; student own marks visible and peer marks hidden; forged user_metadata principal rejected; principal can change own settings but cannot change another school's settings; suspended teacher loses result access and write authorization. Synthetic school, memberships and marks and the temporary suspension were rolled back. Follow-up queries confirmed zero fixture school/mark rows and teacher status active.
- These are database role/JWT-claim simulations, not browser sign-in/session tests. They do not prove all tables, Storage, Edge Functions, signup/reset/email delivery, UI account-switch cleanup, or production capacity.
- Supabase Preview recovery remains unverified until this PR is merged and the integration evaluates the repaired chain. A skipped preview is not a passing database replay.
- A clean local migration replay was not run: no local PostgreSQL/Docker/Supabase CLI runtime is available here. Exact recovered history alignment is verified; pristine-database replay is a separate gate.
