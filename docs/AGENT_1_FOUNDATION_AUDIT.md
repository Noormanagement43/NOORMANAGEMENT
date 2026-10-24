# Agent 1 — Foundation Audit

**Status: PARTIALLY ADDRESSED; full application foundation remains incomplete.**  
**Scope:** repository default branch and the Agent 9 working branch, as visible through GitHub at review time. No production database, secrets, or deployment settings were changed.

## Verified baseline

- The application is a single-page static HTML/CSS/JavaScript frontend in `index.html`, not a Next.js/TypeScript application.
- The current interface has a burgundy/ivory design token palette in CSS custom properties and a responsive sidebar/dashboard shell.
- Supabase JS is loaded from a pinned CDN URL. The browser code uses Supabase Auth, queries institution memberships, loads academic groups, calls `principal-dashboard-data`, and invokes `register_institution_for_current_user`.
- A GitHub Pages deployment workflow exists at `.github/workflows/pages.yml`; it uploads the repository root as a static site.
- Before this change there was no root `package.json` or automated foundation test harness available in the reviewed repository paths.

## Changes made

- Reused the repository's existing `tests/static-audit.test.mjs` and `.github/workflows/quality.yml` rather than introducing a package manager or duplicate test harness. Extended the existing static tests and added a Deno type-check job for the new server-side function source.
- Existing static-audit tests already parse inline JavaScript blocks without executing browser code.
- Extended existing Node built-in tests for document metadata, inline-script syntax, focus/reduced-motion accommodations, role routing, tenant-scoped academic reads, auth recovery, and integration secret handling.
- Extended `.github/workflows/quality.yml` to run the existing static suite and type-check the new Edge Function source. This workflow does not deploy.
- Kept the existing static app and visual design intact rather than replacing the working application with a new framework.

## Important limits

These checks validate source syntax and guard against accidental frontend regressions; they do **not** prove authorization. Browser filters such as `institution_id` are not a substitute for PostgreSQL RLS and server-side authorization. The following remain unverified or incomplete:

1. The repository contains the institution-registration migration, but the three earlier applied migration sources were not found at their reported filenames. Reconcile the exact migration inventory in a verified staging project before modifying schema.
2. Cross-tenant RLS tests, role authorization tests, and real-user browser flows have not been run here.
3. The app remains a single-file JavaScript application; there is no TypeScript build, component library, formatter, or browser E2E suite yet.
4. The Principal dashboard has some live data wiring, but Teacher/Student/Creator workflows and other academic modules are not verified complete.
5. A separate security/release report documents known release blockers, including the public demo Edge Function and leaked-password protection setting. Do not deploy or represent this as production-ready until those blockers are reviewed and tested.

## Verification plan

Run locally with Node.js 20 or newer:

```sh
node --test tests/*.test.mjs
```

Type-check server-side functions with Deno 2:

```sh
deno check supabase/functions/ask-noor/index.ts supabase/functions/send-notice-email/index.ts
```

The existing `NOOR static quality checks` workflow runs the expanded Node suite on pull requests and now includes Deno type-checking for the server-side functions. The prior run from the earlier branch is not evidence for this updated branch. This is static verification only; staging browser tests and RLS isolation tests are still required.
