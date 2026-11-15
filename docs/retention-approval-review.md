# Approval-gated maintenance proposal

Status: draft only. The retention migration was declined; policy-consolidation confirmation expired. Neither has been applied to production. There is no live cleanup schedule or retention function deployment.

## Proposed 30-day retention

- Archive expired weekly/monthly/exam paper payloads and remove their private answer keys in batches. Retain quiz metadata, attempts and assessment-result rows so marks and annual reports remain available.
- Skip pending/ungraded attempts and recently created/approved papers. Block attempts on archived papers and hide archived papers from ordinary reads.
- Remove old Smart Notes photos through the Storage API only after checking that no recent item, other resource type or weekly plan references the same path. Clear old note-photo links after successful Storage deletion. Note text remains available.
- Run an internal token-protected worker hourly, with dry-run support, a maximum batch of 100 and no browser access to privileged RPCs. Existing server credentials stay in the database/function environment.

Worker validation: seven mocked Deno tests pass, including dry-run, Storage failures, fresh references, invalid paths and authorization. Database migration/fixtures and end-to-end Storage deletion remain unverified because production approval was declined. These must pass before activating the schedule. Path claims/tombstones and writer advisory locks are included to protect shared references across Storage/DB operations; these database guards require fixture validation before release.

## Proposed policy consolidation

Combine only the existing permissive OR branches for three named tables. Preserve all restrictive school-membership and feature gates. A FOR ALL policy is split into the same four operations before combination. No extra browser roles or school access are introduced.

Apply only after explicit approval, then rerun role/school isolation fixtures and the Supabase advisors. This draft must not be deployed as part of the already released hardening fix.
