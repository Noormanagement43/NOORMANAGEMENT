# Agent 8 — Gemini / Brevo Integration Progress

**Status: SERVER-SIDE FUNCTION SOURCE ADDED; NOT DEPLOYED.** No Gemini/Brevo credentials were present in this workflow, and the connected Supabase project was not verified as staging. No real email was sent and no paid resources were created.

## Implemented in repository source

### Ask Noor / Gemini
- Added `supabase/functions/ask-noor/index.ts`.
- Requires a bearer token, validates the Supabase user, verifies an active membership for the supplied institution, and checks the institution is active.
- Uses an environment-only `GEMINI_API_KEY` and configurable `GEMINI_MODEL` (default `gemini-3.8-flash`); the key is sent in the `x-goog-api-key` header, never to the browser.
- Restricts CORS to the GitHub Pages origin and local development origins, validates prompt length and institution ID, applies a provider timeout, and returns generic provider errors.
- The model instruction explicitly says it has no access to private institution records. This first version is educational Q&A only, not a database-connected agent.

### Transactional email / Brevo
- Added `supabase/functions/send-notice-email/index.ts`.
- Requires a bearer token and an active institution administrator role.
- Restricts delivery to a recipient email already present on an invitation/membership record for that same institution, instead of accepting arbitrary external recipients.
- Uses environment-only `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, and optional `BREVO_SENDER_NAME`; sends plain text and returns generic provider errors.
- One recipient per request is supported; this is not yet a bulk-notification workflow.

## Required secret configuration (staging only)

- `GEMINI_API_KEY`
- Optional `GEMINI_MODEL`
- `BREVO_API_KEY`
- `BREVO_SENDER_EMAIL` (must be a verified sender in Brevo)
- Optional `BREVO_SENDER_NAME`

Do not place these values in `index.html`, repository files, or client-visible environment variables.

## Before deployment

- A Deno lockfile is committed and the frozen Deno type-check passed in GitHub Actions run 40082096128; keep the lockfile in sync when dependencies change.
- Add persistent per-user/institution rate limits and request quotas before enabling AI or email.
- Verify sender domain, transactional email consent/recipient semantics, retry/idempotency, and audit requirements.
- Add provider-mocked tests and run staging tests with test-only accounts and a non-production sender.
- Deploy only to a verified development/staging project after explicit authorization. These functions were not deployed to the connected project.
