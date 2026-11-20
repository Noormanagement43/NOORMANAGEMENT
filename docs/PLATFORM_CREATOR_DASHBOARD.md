# Platform Creator Dashboard — implementation and release notes

## Scope

NOOR's dedicated `platform-creator.html` console targets the institutional schema:
`public.platform_roles`, `public.institutions`, and institution lifecycle statuses. It is separate from an institution Principal and does not create or elevate roles.

The implementation uses the shared browser publishable-key configuration and the signed-in user's existing Supabase session. Privileged operations are sent to Supabase with the user's own session so database grants, RLS policies, triggers, and constraints remain authoritative. No service-role key is used by the browser.

## Implemented

- Password sign-in and sign-out through Supabase Auth.
- Authorization by reading only the signed-in account's `platform_roles` row.
- Platform-owner and platform-admin dashboard access; support is refused global access when the existing RLS model does not grant it.
- Live exact counts for institution status and school/university type, plus paginated search and filters.
- Institution detail editing for name, country code, default language and timezone.
- Status changes require explicit confirmation; updates are conditional on the previously-read `updated_at` version to reduce overwriting concurrent edits.
- Live pending-institution review queue.
- Empty/error states explain when data or platform-wide analytics are not exposed, rather than using demo values.
- Responsive and reduced-motion styling, keyboard-accessible controls, and text escaping for database-provided content.

## Deliberately not enabled

- **Create institution / send admin invite:** no verified atomic server-side onboarding operation was established by the schema inspection. Directly inserting an institution would risk leaving it without the appropriate Principal/admin membership.
- **Global registered-user and membership counts:** the inspected `institution_memberships` SELECT policy limits visibility to a user's own memberships or institution academic managers. A platform role alone does not grant platform-wide membership rows in that policy. Reading the resulting RLS-filtered zero as a global count would be misleading.
- **Admin activity and security-alert feeds:** no platform audit-event table was found in the inspected `public` schema, and Supabase advisor data is not exposed through a verified browser-safe endpoint.
- **Subscription / usage / billing:** no subscription tables or verified billing integration were found. Nothing charges customers or invokes paid APIs.
- **Membership count/details in institution profile:** intentionally not queried because the current RLS policy does not provide platform-wide membership access.

## Preflight findings — read-only inspection on 24 October 2026

1. The GitHub repository's `config.js` points to Supabase project ref `npzedchxfurcphvpjock`.
2. The Supabase project available through the connected integration is `ayrryemawwplguaauxij`. It has the newer `institutions` / `institution_memberships` schema. These refs do not match.
3. In the connected project, `public.platform_roles`, `public.institutions`, and `public.institution_memberships` have RLS enabled. The read-only inspection returned zero rows for those tables and no platform role assignments. No one can use this console against that data set until the intended project/configuration and an authorised platform role are resolved.
4. `private.is_platform_admin()` accepts `platform_owner` and `platform_admin`; it does not include `support`. The institution directory SELECT policy relies on this helper or active institution membership.
5. The inspected `institution_memberships` SELECT policy does not grant a general platform-role bypass.
6. There is no immutable platform audit table in the inspected public schema. The dashboard displays that limitation before allowing status changes.
7. Supabase security advisors reported a warning for `public.register_institution_for_current_user(text,text,text)` being executable by authenticated users as SECURITY DEFINER and a warning that leaked-password protection is disabled. A separate active Edge Function, `principal-dashboard-preview`, has JWT verification disabled. These were not changed as part of this UI-only implementation.

## Release gates

**Do not treat this console as production-ready until:**

- The project reference in browser configuration and the intended Supabase project are reconciled without accidentally switching existing school data.
- The source schema and migration history are reconciled for the chosen environment.
- An authorised `platform_owner` account is assigned through an approved, controlled process (never via public signup or this UI).
- A secure audit trail records who changed lifecycle status, old/new values, timestamp and reason.
- A server-side onboarding/invitation workflow atomically creates an institution and associates the correct admin membership.
- Global analytics are exposed through an explicitly authorised, tenant-safe view or server-side operation, with RLS/security tests proving its contract.
- The existing Supabase warnings and cross-tenant negative tests are addressed.

## Verification

Automated source-level regression tests are in `tests/platform-creator-dashboard.test.mjs` and run through the repository's existing `node --test tests/*.test.mjs` GitHub Actions workflow. The frontend itself cannot be claimed end-to-end verified until it is pointed to the intended non-production project and tested with authorised and unauthorised Auth accounts. No database schema/data, project settings, secrets, or Edge Functions were changed or deployed by this implementation.
