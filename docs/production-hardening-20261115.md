# NOOR production hardening — 15 November 2026

## Applied and verified

- Added 45 covering indexes across two migrations. Supabase's missing foreign-key index findings fell from 31 to zero. New indexes have little usage history; unused-index informational findings are not grounds to remove them immediately.
- Cached caller-ID lookups in the affected RLS policies. Per-row Auth initialization findings fell from eight to zero. Existing school, role and restrictive feature gates remain in place.
- Fixed the email worker’s missing server-only SELECT privileges on `institutions` and `institution_memberships`. The server role can now read all nine previously skipped recipients. Browser-role grants were not expanded.
- Deployed email worker v5: transient membership/Auth lookup failures now retry with explicit reasons rather than permanently skipping a valid recipient on the first attempt. Invalid, unconfirmed or inactive recipients remain excluded. Tests do not send email. The nine historical skipped rows were not requeued or resent.
- Added free, local checks against very common passwords in signup/reset. Existing login passwords are unaffected. This is a client-side usability safeguard, not managed breached-password protection or a replacement for server enforcement.

## Not applied

- `noor_content_retention` was declined by the approval flow. Its SQL and worker remain on the separate draft branch. No cleanup job or deletion was enabled. The proposed implementation removes old note-photo content and expires paper questions while retaining result rows, attempts, marks and annual reports. Worker mocks pass; the schema change still needs database fixture validation before release.
- Policy consolidation requires dropping/recreating four overlapping permissive policy combinations. Its confirmation expired; this is staged separately and remains unapplied. Existing access rules still function.
- The organization is on Supabase Free. Native leaked-password protection requires Pro; no plan upgrade was requested or performed.
- The managed `pg_net` extension is not relocatable. It was not dropped/recreated merely to silence an advisory because scheduled workers depend on it.

## Verification limits

Node regression checks, email worker tests and rolled-back database fixtures cover the affected paths. Browser execution is unavailable in this environment; real account sign-in, complete visual QA and a production-scale load test are not claimed.

## References

- [Foreign-key index advisory](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys)
- [RLS initialization plans](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan)
- [Multiple permissive policies](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies)
- [Managed password protection and plan availability](https://supabase.com/docs/guides/auth/password-security)
