# NOOR enterprise readiness audit — 6 November 2026

**Decision: NOT READY for commercial launch or a 100,000-student capacity claim.** This is an access-scoped read-only production audit plus a tested development patch. It is not completion of all six implementation phases.

Repository baseline: `a55a1e9a674f9440ef9f77fc9c8053342937d7c9`.
Development branch: `feat/enterprise-readiness-20261106`.
Only production project inspected: `ayrryemawwplguaauxij`.
No production data, secrets, schema, plan or deployments were changed. No load was generated against production.
The accompanying [evidence snapshot](enterprise-audit-evidence.json) contains catalog/advisor metadata and aggregate counts, not student records.

## A. Existing architecture and audit findings

The deployed root application is **plain HTML/CSS/JavaScript**, not a React/Tailwind build. React/TypeScript source exists separately in `src/`, but Pages uploads the root checkout without building it. React lazy-loading and memoization cannot be applied to the live root as though it were a React app. Preserve this application and optimize its actual entry points; do not rebuild it.

Browser → Supabase publishable key and user JWT → PostgREST/RLS, Storage, Realtime.
AI and gateway operations use Edge Functions with verified user sessions and server-side provider secrets.
The canonical tenant key is **institution_id**. It means school ID. Renaming every column to school_id or adding a second tenant identity would create ambiguity without improving isolation. Profiles and platform roles are global user identities; institutions are tenant roots.

### Verified catalog and low-volume observations

| Observation | Result | Evidence/limit |
|---|---:|---|
| Public tables with RLS | 36 / 36 | Catalog at audit time |
| Public tables with primary keys | 36 / 36 | Catalog; 249 total constraints inspected |
| Anonymous SELECT grants on public tables | 0 / 36 | Table privilege checks |
| RLS policies inspected | 114 | Public and Storage combined |
| Storage buckets | 3, all private | Photo, learning-file and logo buckets have size/type restrictions |
| Public tables in Realtime publication | 11 | Publication membership, not authorization or throughput evidence |
| Database size | 17,069,747 bytes | Whole-database snapshot; not a capacity projection |
| max_connections | 60 | Configured ceiling; managed services also consume connections |
| Connections at one observation | 13 | 5 idle, 1 active, 7 without client state; not peak usage |
| Duplicate attendance natural keys | 0 | session_id + student_membership_id |
| Duplicate membership tenant/user pairs | 0 | institution_id + user_id |
| Organization subscription | Free | Authorized organization metadata |
| Project state | ACTIVE_HEALTHY | Project metadata; does not prove application readiness |
| Independent staging environment | Not available | Only a main branch record, status MIGRATIONS_FAILED |
| Latest existing Pages run | Success | [Run 42212508730](https://github.com/Noormanagement43/NOORMANAGEMENT/actions/runs/42212508730) |

Small current catalog row estimates cannot establish production-scale performance. They are estimates, not the business capacity scenarios.

### Security findings and limits

- RLS uses database membership and institution status rather than trusting browser role fields. Active-member helpers check both account membership and school activation. Attendance also has a restrictive active-member guard. Tenant-composite foreign keys protect attendance session/student references and timetable group/teacher references.
- A read-only transaction assumed authenticated role with a nonexistent synthetic subject and forged creator user metadata: **all 36 public table counts were zero**. A separate missing-subject test returned zero institutions, attendance, periods and Storage objects. These are narrow negative tests, not signed-JWT verification or proof of two-school isolation.
- Full School A versus School B, suspended-account, unauthorized write, join-code brute-force, expiry/refresh and Storage-path adversarial tests remain **NOT TESTED**. There is only one existing school in the catalog snapshot; no synthetic production school was created.
- Security advisor reports **leaked-password protection disabled**. It must be resolved or explicitly accepted with appropriate alternative controls before launch. No Auth setting or paid option was changed.
- Root frontend secret-pattern checks found no provider secret or service-role credential. This is not a complete history/credential-forensics scan. Existing browser Supabase CDN reference floats at major version @2 and should be pinned with dependency verification.
- Principal/student timetable reads are role-scoped. Teachers own their writes and a trigger prevents changing owner, creator or tenant. However, the live timing trigger currently accepts teacher-provided times rather than requiring a principal slot. The source also has an explicit test for teacher custom times. This conflicts with the requested principal-only timing authority.
- Conflict validation compares stored weekdays, while daily templates expand across seven days in the UI. Same-class conflicts between different teachers are not comprehensively enforced by the inspected teacher-only overlap trigger. Treat full recurring timetable conflict safety as **FAIL** until staging cases pass.
- Current platform_roles estimate is zero. Secure creator administration and authorized cross-school reporting are not operationally verified.
- Public school discovery RPCs intentionally allow anonymous execution; review their minimal output and request limits. Anonymous EXECUTE on trigger functions is not equivalent to a directly callable data endpoint.
- Obsolete project text occurs in historical migration/audit documentation and negative tests. No active frontend connection to that project was found. Historical files were preserved, and the obsolete project was never contacted.

### Database and frontend bottlenecks

Performance advisor: **15 uncovered foreign keys**, **7 auth initialization-plan warnings**, **35 unused-index findings**. Do not add all FK indexes or drop all unused indexes automatically; small traffic and recent statistics make these insufficient evidence.

Existing attendance indexes cover tenant/marked time, student/marked time, session+student uniqueness and tenant-composite FK lookups. Timetable indexes cover institution/day/time and teacher/day/time. Marks have institution/student/date coverage. New composite indexes need authenticated staging EXPLAIN measurements and write-cost comparison.

The principal loader `noor-principal-data.js` pages through and retains the entire school roster, enrollments and historical attendance in the browser. Pagination of transport does not solve whole-dataset memory/CPU costs. Its normalization also repeatedly scans enrollments per member. Replace the overview with a school-scoped aggregate RPC and separately paged directories in the next staging phase; preserve the existing response semantics and visual cards. The separate deployed principal-dashboard-data function uses unpaged queries and marked_at-based counts, risking truncated or misleading totals.

The attendance register currently obtains a rich class-performance RPC for a roster, including analytics it does not need. That RPC permits five-year ranges and performs subject aggregation per student. Split roster and progress queries, use bounded date ranges, and measure with tenant RLS.

Attendance batch saving already uses a transaction, advisory lock, enrollment checks, duplicate-student validation and upsert. A daily session is reused. Replay updates marked_at and can add audit events, so state idempotence is not exactly-once side-effect processing. The canonical teacher UI requires complete acknowledgement before success. The legacy offline queue calls a legacy RPC unavailable in the new schema; canonical offline workflow and account-switch synchronization require further work.

Many scripts are synchronously linked on initial load. Local file measurement: index.html **196,554 bytes**, 86 linked local files, **1,877,861 raw bytes / 638,980 gzip bytes** combined, excluding external assets and dynamic requests. This is a size inventory, not measured transfer encoding, mobile time-to-usable or Core Web Vitals.

## B. Implemented development changes

| File | Change | Verification |
|---|---|---|
| noor-shared-timetable.js | Stable 500-row pages for periods/daily lessons, explicit teacher filter, original display ordering restored after paging | Mocked 501-row coverage |
| noor-shared-timetable.js | Coalesces simultaneous reads per user+school; rejects stale school results | Behavior tests; no persistent private cache introduced |
| noor-shared-timetable.js | Debounced recovery refresh, jittered visible/online polling after channel failure, logout/page lifecycle cleanup | Mock channel/timer tests; live socket reliability untested |
| scripts/build-static.mjs | Builds dist with browser assets; excludes SQL, archives, repository directories and the Node ZIP generator | Temporary-directory packaging test plus actual build |
| .github/workflows/pages.yml | Runs regression suite before packaging; uploads dist instead of the checkout | Source reviewed, build locally verified; changed workflow not deployed |
| scripts/load-test.mjs | Repeatable staging-only HTTP scenarios A–E, latency/error metrics, acknowledgement checks, timeouts and circuit breaker | Guard, metric and mock transport tests |
| tests/enterprise-readiness.test.mjs | Nine behavior/security/packaging checks | All passed |
| supabase/proposals/enterprise_auth_initplan.up.sql | Seven policy changes wrapping auth.uid() in SELECT, preserving predicates/roles | Draft only; not executed |
| supabase/proposals/enterprise_auth_initplan.down.sql | Exact previous predicates for rollback | Draft only; not executed |
| supabase/proposals/enterprise_health_snapshot.sql | Read-only operational queries without query texts or student records | Not executed as a complete script |
| docs/enterprise-health.html | Offline health scorecard snapshot with links to evidence and report | Source artifact; not a live monitoring service |
| .gitignore | Excludes build output and local load credentials/results | Reviewed |

**Tests executed:** baseline 216/216 passed; final Node suite **225/225 passed, zero skipped**, Node v24.22.1. `git diff --check` passed. Static build succeeded, approximately 2.73 MB directory bytes. The load runner was exercised with a mock fetch transport only; its millisecond values are not SaaS performance results.

Deno, Supabase CLI, k6, psql and Docker are unavailable in this runtime. Edge Function tests and database SQL tests were not executed. Because the Supabase CLI was unavailable and the repository mixes legacy and canonical migrations, SQL is deliberately placed under proposals rather than pretending to be a registered, deployable migration. Generate the final migration with the current CLI after staging review.

A local Playwright launch was attempted but failed before page navigation because the environment denied Chromium process-singleton sockets. No Android, browser-render, visual regression or mobile latency pass is claimed.

## C. Load-test report and execution guide

| Scenario | Active users | Workload subset supplied | Executed | p50 / p95 / p99 | Errors | Verified capacity |
|---|---:|---|---|---|---|---|
| A | 100 | Login, membership, timetable and role reads | NOT TESTED | N/A | N/A | None |
| B | 500 | Teacher attendance and reads | NOT TESTED | N/A | N/A | None |
| C | 1,000 | Mixed principal/teacher/student, multiple schools | NOT TESTED | N/A | N/A | None |
| D | 5,000 | Mixed read/write, explicit high-load acknowledgement | NOT TESTED | N/A | N/A | None |
| E | 10,000 | Controlled mixed workload, explicit high-load acknowledgement | NOT TESTED | N/A | N/A | None |

**Actual breaking point: unknown. Maximum verified concurrent capacity: not established.**
The HTTP runner is an equivalent dependency-free workload tool, not a full browser dashboard or Realtime benchmark. It records RPS, p50/p95/p99 by operation, errors and response throughput. Authenticated VUs are reported separately from configured VUs. Rate-limit/login failures count as failures.

Before execution:
1. Provision an explicitly authorized non-production Supabase project, baseline its canonical schema safely, and create synthetic schools/accounts. Do not blindly replay the mixed legacy migration folder. Never clone real student records into test fixtures.
2. Prepare a local `load-fixtures.json`: `{project_ref, synthetic:true, users:[...]}`. Each user needs distinct .test email, password, institution_id, membership_id and role (student/teacher/principal). Teachers in B–E additionally need group_id, a valid nonfuture date and a complete records array of `{student_membership_id,status}` for that synthetic roster. Provide at least one distinct account per VU. C–E require at least two schools and all three roles.
3. Set NOOR_STAGING_URL to the exact HTTPS origin with no trailing slash; NOOR_STAGING_PROJECT_REF; NOOR_STAGING_PUBLISHABLE_KEY; NOOR_LOAD_AUTHORIZED to that same reference; NOOR_LOAD_FIXTURES to the local fixture path; NOOR_LOAD_SCENARIO=A/B/C/D/E. For D/E also set NOOR_HIGH_LOAD_ACK to the staging reference after infrastructure/budget review.
4. Run `node scripts/load-test.mjs`. Default hold is 60 seconds per authenticated VU after a default 50 ms per-VU ramp; total elapsed includes ramp and login. Configure NOOR_LOAD_SECONDS (1–900), NOOR_LOAD_RAMP_MS (0–1000) and NOOR_LOAD_OUTPUT as needed. Run A first, then 5–15 minute plateaus after correctness and budgets pass. Never substitute a production URL.
5. Record CPU, memory, database connections, disk IO, Realtime connections/messages/reconnects and queue depth in synchronized server telemetry. Record generator CPU, memory, event-loop lag, bandwidth, location, dataset size and cache state. The runner itself must not be the bottleneck.
6. Run full browser/mobile workflows, two-tenant adversarial tests and WebSocket authorization/stability alongside HTTP scenarios. Its limited HTTP PASS is not an enterprise acceptance PASS.

Runner failure gates: operation error rate >=1%; read/write p95 >=800 ms; login p95 >=1500 ms. These are initial test budgets, not baseline-derived production alerts. A >10% aggregate error rate after 100 requests trips the circuit breaker. No automatic retry is used for uncertain writes or AI generation. Warm-cache p95 <300 ms and UI <200 ms need separate instrumentation. Abort rather than escalate load when server telemetry crosses approved limits.

## D. Infrastructure and capacity plan

### Business scenarios, not existing usage

| Stage | Schools | Students | Annual daily attendance rows at 220 school days | Capacity status |
|---|---:|---:|---:|---|
| Pilot | 1 | 500 | 110,000 | NOT TESTED |
| Stage 1 | 10 | 5,000 | 1,100,000 | NOT TESTED |
| Stage 2 | 20 | 20,000 | 4,400,000 | NOT TESTED |
| Stage 3 | 50 | 50,000 | 11,000,000 | NOT TESTED |
| Enterprise | 100 | 100,000 | 22,000,000 | NOT TESTED |
| Future | 500 | 500,000 | 110,000,000 | NOT TESTED |

At 100 schools × 1,000 students, 100,000 daily rows over a ten-minute window is about 167 rows/second. Batches of 30 would average about 5.6 submissions/second, plus reads, Auth and Realtime traffic. This is an illustrative workload calculation, not a throughput result. Peak burst distribution, audit write amplification and RLS cost must be measured.

**Hosting blocker:** GitHub expressly disallows using Pages to provide commercial SaaS. Migrate the unchanged static frontend to a host permitting this use before commercial launch. Compare current terms and required security headers first; no host, paid service or deployment was provisioned. The packaging fix is useful for current preview safety and portable deployment, but does not make Pages commercially suitable.

**Confirmed current plan: Free.** Public plan documentation lists 500 MB database, 1 GB object storage, 50,000 MAU and 5 GB uncached egress. Realtime Free currently lists 200 concurrent connections and 100 messages/second. Active application users are not equal to DB connections; avoid holding direct database sessions from browsers. Existing browser PostgREST usage does not establish the Supavisor pool settings; pool utilization/configuration needs dashboard verification.

Published Pro starts at **USD 25/month**, with 100,000 MAU included and usage/compute extras. Free managed daily backup retention is not available on the same basis as Pro. Pro includes seven days of daily backups. PITR is extra; published seven-day PITR is about USD 100/month, excluding compute/other costs. No upgrade is authorized or performed.

If 500,000 people were actually monthly active, the published Pro MAU overage alone would be 400,000 × USD 0.00325 = USD 1,300/month, plus the base subscription, compute and other usage. Student registration counts alone cannot price this. For any stage the defensible cost estimate is base plan + measured compute + MAU/egress/storage/function/Realtime overages + backup needs, taxes and exchange conversion; no unsupported per-stage quote is supplied.

Initial review triggers: sustained CPU >70%, DB connections >70% of usable pool budget, disk/storage >70% quota, Realtime >70% of plan limits, p95 API budget breaches, retry/error growth or queue age exceeding its SLA. Confirm actual compute and telemetry before defining operational limits. Review at 50% of storage/egress budget; do not wait until a hard cap. These are proposed guardrails, not measured thresholds.

### Caching and Realtime

Keep authenticated session/role checks live. The patch coalesces in-flight requests but retains no completed private response cache. For future branding/class/section/subject/slot caches, key by project+user+institution+role/resource and use bounded TTL; clear on signout, account/school switch, suspension response and relevant writes. Do not place attendance/marks/Auth responses in a public service-worker cache.

The timetable patch adds bounded fallback polling only while realtime is interrupted and the page is visible/online. Supabase handles channel reconnect; recovery performs a refresh. Other independent modules still have channels and refresh loops; a whole-app subscription registry is future work. Filter payloads and re-fetch under RLS; never infer authorization from the client channel filter. Add publication and DELETE-event authorization tests before signoff.

### AI and background jobs

Inspected AI/gateway code verifies user identity, active membership and institution, stores provider credentials server-side, uses a shared database budget and a 25-second provider-fetch timeout. Gemini/Groq are the configured primary options. Do not assume any default model name, free quota or generated response is currently available without a provider-specific probe. No generation/provider quota was consumed in this audit.

Cancellation propagation, token/usage accounting, jittered transient backoff, safe fallback and a durable AI execution queue remain incomplete. Do not automatically retry an uncertain generation and double its cost. Do not send raw student personal data to a provider as a default.

The existing workflow table supports idempotent drafts; the gateway explicitly reports no external execution. It is **not a verified running job processor**. Prefer an existing-database worker/queue over introducing Redis: queued→running→succeeded/failed; transactionally claim with SKIP LOCKED; lease expiry; attempts/max_attempts; next_attempt_at; unique tenant idempotency key; dead-letter review; sanitized result/error metadata. External effects such as email need provider idempotency or reconciliation after uncertain acknowledgement. Worker privileges must be restricted to specific operations and tenant scope. Implement schema/worker changes in staging and seek migration approval; no background messages were sent.

## E. Production readiness and operational health scorecard

PASS means only the named, evidenced check passed; NOT TESTED means a release gate remains open.

| Area | Status | Reason |
|---|---|---|
| Correct production project connection | PASS | Authorized project metadata and runtime config |
| RLS enabled, PKs, anonymous table privileges | PASS | 36-table catalog checks |
| Non-member forged-metadata read test | PASS | Zero rows in all 36 public tables |
| Full two-school data isolation | NOT TESTED | No synthetic staging schools |
| Authentication end-to-end | NOT TESTED | No live login/reset/expiry/brute-force suite |
| Leaked-password protection | FAIL | Disabled advisor finding |
| Suspension enforcement end-to-end | NOT TESTED | Helpers/guards inspected; lifecycle tests pending |
| Secrets in scanned frontend | PASS | No privileged-key pattern found in inspected files |
| Database performance SLOs | NOT TESTED | No authorized staging profiling |
| Attendance transaction code review | PASS | Lock, roster validation, upsert and acknowledgement |
| Attendance failure/retry/offline lifecycle | NOT TESTED | Canonical and legacy queue compatibility unresolved |
| Principal-only timetable timing authority | FAIL | Live trigger permits custom times |
| Recurring/class timetable conflict coverage | FAIL | Stored-weekday/teacher-only validation gap |
| Frontend regression suite | PASS | 225/225 local Node tests |
| Frontend/mobile performance SLOs | NOT TESTED | Browser execution blocked |
| Live Realtime reliability | NOT TESTED | Patch mock tests only |
| Managed backup/restore readiness | NOT TESTED | Free plan confirmed; no successful restore evidence |
| Monitoring and incident alerts | NOT TESTED | Queries/runbook supplied, service alerts not wired |
| Deployment packaging tests | PASS | Runtime-only dist build verified |
| Commercial deployment readiness | FAIL | Pages use restriction and remaining release gates |
| 100,000-student capacity | NOT TESTED | No load scenarios executed |

### Monitoring implementation plan

Use [enterprise_health_snapshot.sql](../supabase/proposals/enterprise_health_snapshot.sql) through an authorized monitor and aggregate results server-side. Never expose monitoring credentials or raw query texts. The companion HTML is explicitly a dated offline snapshot, not a healthy-looking live dashboard. Existing NOOR Security Watch monitors GitHub; it does not establish DB/API monitoring.

| Signal | Proposed initial alert | Action |
|---|---|---|
| API 5xx | >1% for 5 minutes, with >=100 requests | Inspect correlated gateway/database errors |
| API p95 | >800 ms for uncached requests, 5 minutes | Inspect endpoint, RLS plan and saturation |
| Connections | >70% usable budget for 5 minutes | Check leaks, pool queue and long transactions |
| Frontend crashes | Repeated new fingerprint affecting real sessions | Pause release, inspect sanitized stack |
| Auth failures | Sudden baseline-relative/IP/account spike | Review abuse; avoid logging passwords/tokens |
| Realtime | Reconnect/error spike or missed recovery | Inspect limits; check polling recovery |
| Edge/AI/email | Failure rate/queue age above agreed SLA | Inspect quota/provider health and dead-letter queue |
| Storage/disk | 70% warning, 85% urgent | Review growth/retention, request capacity decision |
| Deploy checks | Any failed required check | Block promotion and link failed job |

Collect a 7-day baseline before tuning these alerts. Deduplicate by incident/fingerprint, use a recovery notification, and name one owner per incident. No notification route was configured or message sent.

### Recovery strategy: proposed, not verified

Targets after implementation: pilot RPO <=24 hours and RTO <=4 hours. They are not current guarantees. For stronger enterprise recovery, define the commercial RPO/RTO and price PITR/off-site storage before committing.

Free plan: schedule encrypted daily logical exports to a separate approved durable location; retain seven daily and four weekly versions as an initial policy. Back up Storage object bytes and object metadata separately: database backup alone is not a file-content backup. Include required database roles, Auth/configuration documentation and migration versions; secrets need a separately protected recovery mechanism.

For deletion/corruption/failed migration: stop writes, preserve evidence, restore into a clean isolated project, validate tenant counts/FKs/RLS/Auth and object access, then approve cutover. Do not overwrite production as a first diagnostic step. Test restores monthly and after material schema changes; record start/end time and observed data loss. For a bad frontend release, redeploy the previously verified runtime artifact after approval. Keep schema backward compatible with that artifact. For an outage, show a truthful unavailable/pending state; never acknowledge an unconfirmed attendance save.

Production backup configuration, off-site copies, retention enforcement and a successful restore are **NOT VERIFIED**. Do not promise recovery from an untested plan.

### Indian student privacy review

MeitY published DPDP Rules and a separate commencement timeline in November 2025; the government describes phased implementation over 18 months. As of this audit, do not treat notification as proof that every substantive duty is already in force. Obtain legal review of the official commencement notification, December corrigendum, applicable sections/rules and education exemptions before launch.

Build purpose-specific notices and data minimization, verified guardian relationships/consent where applicable, consent evidence and withdrawal workflows, a rights/contact channel, correction/export/deletion requests and an institution-approved retention policy. A parent phone field or join code is not verified parental consent. Define school versus NOOR responsibilities contractually and inventory Supabase, email and AI processors. Avoid unnecessary DOB, guardian contact or photo sharing. Document breach response and preserve auditable access/action records. The project is hosted in Singapore (ap-southeast-1); counsel must assess processing location, contracts and any applicable transfer/localization conditions. No legal compliance certification is made.

## F. Completed, pending and blocked

**Completed and verified:** access-scoped read-only catalog/policy/function/constraint/index/storage/publication audit; non-member and missing-subject read tests; targeted duplicate checks; Free plan verification; safe branch patch; 225 local Node tests; runtime packaging.

**Implemented but not validated on staging:** timetable pagination/deduplication/lifecycle changes, changed CI workflow, guarded load framework. No production rollout occurred.

**Draft SQL only:** seven auth-initplan policy changes and exact predicate rollback. No index changes were guessed. Register and apply only after approval, staging schema drift comparison, semantic RLS tests, EXPLAIN (ANALYZE, BUFFERS) at realistic cardinality and rollback rehearsal.

**Pending approval when ready:** production migration/deployment, any backup/data export requiring approval, paid compute/backup/hosting changes. Do not ask for production promotion before remaining gates pass.

**Requires capacity decision:** Free Realtime limits cannot support the requested 500–10,000 simultaneous Realtime clients as currently listed. Whether all active users need sockets must be measured. Larger scenarios and recovery objectives may require paid resources; none were purchased.

**Blocked:** no independent authorized synthetic staging environment, no tested backup restore, restricted browser runtime, no recorded system telemetry during a capacity test. These block full security/performance acceptance and a commercial readiness claim.

### Sources checked

- [GitHub Pages limits and commercial SaaS restriction](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
- [Supabase pricing](https://supabase.com/pricing)
- [Supabase Realtime limits](https://supabase.com/docs/guides/realtime/limits)
- [Supabase backups and PITR](https://supabase.com/docs/guides/platform/backups)
- [Supabase RLS and scalar auth-call optimization](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
- [MeitY rules, corrigendum and commencement notification index](https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa)
- [Government explanation of phased DPDP rules and child-data safeguards](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2190014)
