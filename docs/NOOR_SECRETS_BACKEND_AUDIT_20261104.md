# NOOR secrets compatibility and backend audit — 4 November 2026

**Live verification update:** Gemini and Groq authenticated and generated the expected test reply. OpenAI authenticated but has no manager model configured. Brevo rejected its stored key with HTTP 401. The initial unverified status below is historical; see [live verification](NOOR_PROVIDER_LIVE_VERIFICATION_20261104.md) for current results.

## Scope and evidence

Inspected GitHub main `a779e2b43c850118f677eb49995d606089ac9f4c`, fetched deployed function source and deployment metadata, and ran read-only Supabase metadata queries and security advisors. Local audited file hashes matched GitHub main. Used the existing connected project `ayrryemawwplguaauxij` (ACTIVE_HEALTHY); no reconnection requested.

The user reports four bulk-saved custom secrets named exactly `groq`, `gemini`, `chatgpt`, `brevo`. Their values were not requested, retrieved, printed, logged or committed. Available connected tools cannot list secret metadata, inspect Auth SMTP settings or invoke a function as an authenticated NOOR user. Runtime presence and real provider authentication are therefore **unverified**, not assumed from the user-reported dashboard timestamps.

No database schemas, tables, policies, records, memberships or Auth configuration were changed during this audit/compatibility fix. No fixture inserts, real AI generations or outbound emails were performed.

## Repository audit

| Area | Classification | Finding |
|---|---|---|
| Canonical AI assistant | Implemented, real-provider test pending | `noor-v2-ai` authenticates users and checks active institution membership; chat, notes, papers, OCR and other draft actions exist |
| Gemini | Implemented + misconfigured secret-name contract | Reads `GEMINI_API_KEY`; did not read user-saved `gemini` before this fix |
| Groq | Implemented + misconfigured secret-name contract | Reads `GROQ_API_KEY`; requests `api.groq.com`, **not xAI Grok**; saved key's actual issuer cannot be confirmed without a provider response |
| OpenAI | Partially implemented | Optional manager API adapter exists; `OPENAI_MANAGER_MODEL` is required; saved `chatgpt` was not recognised |
| Brevo application email | Partially implemented, not deployed | Legacy `noor-school-automation` source reads `BREVO_API_KEY`, references unavailable `schools`, `school_memberships`, `notification_events` and other legacy tables |
| Confirmation/recovery email | Configuration unverified | Supabase Auth requires its SMTP configuration or a Send Email Hook; an Edge Function API secret alone does not configure Auth delivery |
| Friendly AI UI / Ask Noor | Implemented, role/device acceptance pending | Existing `noor-secure-assistant.js` mounts from Settings; no second login or floating mascot was introduced; multilingual prompting exists, not formal language QA |
| Student performance insights | Partial | Aggregate insights accept caller-supplied figures; they are not an autonomous verified-data analytics pipeline. Canonical marks/attendance backend exists but legacy UI paths remain |
| Principal analytics | Partial | `principal-dashboard-data` uses canonical institutional data with authenticated leadership access; broader legacy command-centre integration remains incomplete |
| General MCP task execution | Not implemented | Internal JWT MCP can generate drafts; external OAuth/client lifecycle, leased workers, retries, delivery processing and approved provider mutations remain pending |
| Frontend data contract | Broken/incomplete paths | Several existing screens still expect the legacy school schema; replacing credentials alone did not port them |

## Supabase Edge Functions audit

| Function | Deployed at audit start | JWT setting | Scope |
|---|---|---|---|
| `noor-v2-ai` | Active | Required | AI generation and provider probes; membership and active-institution checks |
| `noor-backend-api` | Active | Required | Scoped registration/task drafts, member status RPC access and internal MCP |
| `principal-dashboard-data` | Active | Required | Canonical principal data feed |
| `principal-dashboard-preview` | Active | Not required | Static preview source; no provider secret lookups; must not be treated as a live authenticated dashboard |
| `noor-ai` | Repository only | Not deployed | Older integration; do not deploy as a substitute without migration review |
| `noor-school-automation` | Repository only | Not deployed | Older school-schema email integration; unsafe to claim operational in the new database |

Secret updates may change Supabase function version numbers without source changes; source fingerprints and fetched files were used for the audit.

## Secret compatibility

| Service | User-saved name | Previous expected name | Before fix | Correction |
|---|---|---|---|---|
| Gemini | `gemini` | `GEMINI_API_KEY` | Name did not match | Accept canonical name or explicit `gemini` alias server-side |
| Groq | `groq` | `GROQ_API_KEY` | Name did not match | Accept canonical name or explicit `groq` alias server-side |
| OpenAI | `chatgpt` | `OPENAI_API_KEY` | Name did not match | Accept canonical name or explicit `chatgpt` alias server-side |
| Brevo | `brevo` | `BREVO_API_KEY` | Name did not match | Accept canonical name or explicit `brevo` alias in authenticated metadata diagnostics; no email sending was enabled |

The safest proposed correction was explained before code changes: preserve existing secret values/names, add explicit backend aliases, and reject conflicting duplicates. This avoids asking the user to expose/re-enter keys or silently selecting an old key. Canonical and alias values may coexist only if identical. Secret values are never returned; only detected names and result flags may be reported.

`OPENAI_MANAGER_MODEL` remains separate configuration. No paid OpenAI model was automatically selected. `GEMINI_MODEL` and `GROQ_MODEL` retain server-side selection. Primary provider defaults to Gemini; Groq is selected only deliberately with `NOOR_AI_PROVIDER=groq`. No automatic cross-provider fallback was added.

The existing legacy email sender was not deployed or retrofitted around missing production tables. It still requires a separate canonical email implementation review.

## Independent provider verification report

| Provider | Secret visible | Environment matched at audit start | Environment compatible after fix | Authentication successful | Real API response | Delivery/generation |
|---|---|---|---|---|---|---|
| Gemini | User confirms Yes; runtime not independently detected | No for reported lowercase name | Yes, code supports alias | Not tested live | Not tested live | Not tested live |
| Groq | User confirms Yes; runtime not independently detected | No for reported lowercase name | Yes, code supports alias | Not tested live | Not tested live | Not tested live |
| OpenAI | User confirms Yes; runtime not independently detected | No for reported lowercase name | Yes, model setting still required | Not tested live | Not tested live | Not tested live |
| Brevo | User confirms Yes; runtime not independently detected | No for reported lowercase name | Yes for metadata probe; sender still pending | Not tested live | Not tested live | No email sent |

Current blocked live checks are not authentication failures. They lack an authorised runtime invocation session. Do not substitute a key-format guess, a dashboard timestamp, a code test or a 401 from the Supabase gateway for a provider authentication result.

After an authorised active-institution principal invokes the existing `probe` action, the four services report independently: `secret_detected`, `environment_matched`, `secret_name`, `authentication_successful`, `api_response_successful`, HTTP status and a normalised error code. AI metadata access is distinct from a generated answer. Brevo `GET /v3/account` confirms only account API access; it neither proves sender verification nor email delivery. Account response bodies are discarded without parsing or logging.

All probes remain behind JWT verification, fresh user validation, active institution membership and leadership checks. They use the existing budget RPC; a future live probe may update ordinary usage counters. No probe was invoked against production during this audit.

## Security audit

Read-only findings:

- Zero public ordinary tables without RLS enabled. This does not by itself certify every policy as correct.
- Canonical AI calls retain caller JWTs, active institution checks and role restrictions; no service-role bypass was added.
- Current counts: **0 institutions, 0 active memberships, 0 platform-role records**. Administrative and institution test access cannot be assumed.
- Legacy `schools`, `school_memberships`, `notification_events` do not exist in this project. Those email/UI flows require migration, not relaxed RLS.
- Existing security-advisor warning: leaked-password protection is disabled. Remediation: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Provider secrets remain server-side. Compatibility metadata never includes their values. Conflicting aliases fail closed.
- Legacy automation source contains wildcard CORS, default sender configuration and broader error logging; it remains undeployed and needs hardening before use.
- The unauthenticated preview is a static artifact, not authorization for live school data.

## Exact files

Changed in this compatibility step:

1. `supabase/functions/noor-v2-ai/providers.ts` — explicit aliases, conflict rejection and independent metadata probes for all four services.
2. `supabase/functions/noor-v2-ai/index.ts` — canonical status names, isolated optional-manager configuration, independent provider report under existing permissions.
3. `supabase/functions/noor-backend-api/index.ts` — status detects the reported lowercase aliases without exposing values.
4. `supabase/functions/noor-v2-ai/providers_test.ts` — alias/conflict, Brevo no-send/no-account-data and independent-provider error tests.
5. This audit report and updated secret reference documentation.

Requiring subsequent scoped work:

- `supabase/functions/noor-school-automation/index.ts`: canonical membership/data contract, verified sender, email queue/deduplication, delivery handling and minimal logs; do not deploy legacy code as-is.
- `command-centre.js`, `noor-parent-support.js`, notification/attendance callers: wire the approved canonical email endpoint and enforce recipient/tenant checks.
- `index.html`, `academic.js`, `student-portal.js`, `principal-studio.js`: complete canonical onboarding and remaining legacy CRUD/data-path migration.
- Supabase Auth SMTP/Send Email Hook settings: inspect provider configuration and verify confirmation/recovery. Current tools do not expose these settings.

## Next implementation order

1. Verify the deployed alias fix with an authorised runtime session; record each provider's real metadata result, then a tiny non-sensitive generation for each configured AI model.
2. Obtain explicit owner approval before creating any production test institution/membership or changing production schema/data. Until then use isolated local/staging fixtures.
3. Confirm `OPENAI_MANAGER_MODEL` and Brevo verified sender/SMTP configuration without requesting key values in chat.
4. Propose/review the canonical email schema and worker design before any database migration. Implement no-send diagnostics first, then test actual delivery only to an explicitly authorised recipient.
5. Complete role-based UI/data wiring and real-account acceptance tests. Preserve existing design and tenant isolation.

## Local verification

74 existing Node regression tests and 10 Deno gateway/provider tests pass. New tests use dummy credentials and mocked network responses only. They verify aliases, conflicting-name rejection, no raw key/account-body exposure, no email sending, independent failures and existing permission boundaries. This is implementation validation, not proof that the user's saved provider credentials authenticate.

No schema/data migration was applied. No Auth settings or provider secret values were modified.
