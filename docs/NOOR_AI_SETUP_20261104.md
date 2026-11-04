# NOOR AI brain, manager and connector setup — 4 November 2026

**Secret-name compatibility update:** existing lowercase `gemini`, `groq`, `chatgpt`, `brevo` names are accepted by the canonical AI/diagnostic code. Conflicting canonical/alias values fail closed. See [current backend audit](NOOR_SECRETS_BACKEND_AUDIT_20261104.md). Brevo delivery and Auth SMTP are still separate, unverified integrations.

## Add credentials here

Open https://supabase.com/dashboard/project/ayrryemawwplguaauxij/functions/secrets → Add secret → name/value → Save.

| Secret | Purpose | Required? |
|---|---|---|
| `GEMINI_API_KEY` | Primary Gemini brain | Yes, for Gemini |
| `GEMINI_MODEL` | Explicit model available to your Google account | Optional; default `gemini-3.5-flash-lite` |
| `NOOR_AI_PROVIDER` | `gemini` or `groq` | Optional; default `gemini` |
| `OPENAI_API_KEY` | OpenAI manager API | Only for manager + brain mode |
| `OPENAI_MANAGER_MODEL` | Account-accessible OpenAI model ID | Required for manager mode; no automatic model substitution |
| `GROQ_API_KEY` | Optional open-weight alternate provider | Only for Groq |
| `GROQ_MODEL` | Groq model ID | Optional; default `openai/gpt-oss-120b` |
| `BREVO_API_KEY`, `EMAIL_FROM` | Future email adapter | Not used by the current AI route |

Provider keys belong in Supabase Secrets for these runtime functions. GitHub Actions secrets serve CI/deployment separately; they do not automatically become Supabase function secrets. Never paste keys in chat, JavaScript, a school joining-code field or public GitHub files.

After saving, an active Principal can open Settings → NOOR AI workspace and select **Check AI connection**. This makes metadata-only provider/model checks. It distinguishes missing keys, model access and rate limiting; it does not claim a successful generation until an actual question is answered.

## What now executes

- `noor-v2-ai` v3: Gemini by default; explicit optional Groq route, without silent fallback or cross-provider data sharing.
- Existing assistant, paper-generator AI request and academic generation requests now call the deployed canonical function, passing the institution explicitly.
- Actions: chat, structured paper plus answer key, syllabus image transcription, smart notes, weekly plan, report formatting, aggregate insights, connection probe and manager plan.
- Gemini image input accepts at most eight JPG/PNG/WebP images, with a bounded request size. The current Groq adapter is text-only and rejects images explicitly.
- The manager mode calls the selected OpenAI model to propose a plan, then the configured brain to create a draft. Both providers receive the user-supplied task. Neither model receives database administration credentials or executes email/GitHub/school mutations.
- The internal MCP now exposes `noor_ask_brain` and `noor_manager_plan` in addition to its three existing task/connection tools. These AI calls consume quota; their MCP annotations explicitly flag external provider access and non-idempotency.
- API credentials are never sent to the browser. Provider errors are normalised without forwarding raw upstream bodies. Chat replies use text rendering. A late reply is discarded if the signed-in account/institution changed.

No provider key values were supplied, retrieved or saved by this development work. Live generation and real-account metadata probes remain unverified until credentials and an active institution membership are available. Tests use mocked provider responses, not real billed model calls.

## Shared usage controls

`noor_take_ai_budget` authorises active membership, enforces a shared 8 requests/minute/user guard, and applies server-configured daily request budgets. Defaults: 100 units/user/day and 1,000 units/institution/day, UTC. Manager mode admits two units; other AI actions/probes admit one. Failed attempts can consume admitted units. These are request guards, not token-price billing or student enrolment limits.

Trusted platform administration can configure different limits per institution in `private.noor_ai_limits`. School clients cannot update that table or raise their own quotas. Daily tenant admission is serialised in Postgres to prevent simultaneous requests overspending the configured unit budget.

The user-supplied 20 × 5,000 example is **not** a product capacity promise or institution limit. Capacity planning still requires actual concurrency, attendance/report patterns, storage, recovery and load-test targets.

## What authorization means

Authorising GitHub/Supabase in this ChatGPT session grants the connected development tools access to the approved account/repositories/projects. It does not connect all NOOR customers to those services or share that authorization with Gemini/Claude.

For an external app, extend the central gateway with an adapter that declares provider endpoints, allowed tools, required scopes and tests. Reuse the same institution/identity/audit layer. Each customer must complete that provider's own OAuth/installation consent; keep encrypted refresh tokens server-side, implement revocation, and check scopes on every action.

- GitHub: installation-scoped GitHub App, selected repositories; Enterprise host/SSO must be supplied and verified.
- Gmail: Google OAuth client, exact approved redirect domain, least-privilege scopes, consent/verification as needed, encrypted refresh tokens.
- Brevo: API credential, verified sender, signed/verified delivery callbacks and a queued email adapter.
- External ChatGPT/Gemini/Claude MCP clients: gateway OAuth discovery, PKCE, client registration policy, consent, access-token audience checks and revocation still need implementation and real client validation.

The internal JWT MCP is not advertised as an OAuth-ready public customer connector. Do not paste a long-lived NOOR user access token into a public connector URL or configuration.

## Remaining product gaps

1. Several existing dashboard CRUD paths still use legacy `school_id` tables/RPCs. This AI wiring change does not port those paths or make every button functional. The old v2 URL intentionally redirects to the original app; no second login screen was reintroduced.
2. School onboarding/joining UI and membership administration still need complete canonical-backend wiring and signed-in role/device tests. The new production database has no onboarded institutions yet.
3. External service OAuth/installation credentials and a callback domain are not available. Consumer chat logins do not substitute for API credentials.
4. General task execution needs a leased job worker, retries/dead letters, per-action authorization, idempotent adapter writes, approval controls and provider webhooks. Current workflow jobs remain drafts; AI requests execute synchronously.
5. Production work still includes real-account end-to-end tests, measured load tests, restores, alerting/observability and enabling Supabase's remaining leaked-password protection setting where the plan supports it.
6. AI history, generated paper persistence/PDF publishing and student progress export still need complete UI/backend integration; an AI draft is not a saved or published academic record.

## Free/open alternatives, checked against official docs

- Groq hosts the open-weight `openai/gpt-oss-120b` model. Its free plan has model-specific quotas; inspect your own account limits. Open weights do not mean unlimited hosted inference. https://console.groq.com/docs/models and https://console.groq.com/docs/rate-limits
- OpenRouter offers `:free` models and a free-model router, with published request caps and varying availability. https://openrouter.ai/collections/free-models/
- Gemini has a limited free tier, but is not an open-source model. Its free-tier content may be used to improve Google products; review the applicable terms before sending identifiable student information. https://aistudio.google.com/docs/pricing
- The old `gemini-2.5-flash` default is deprecated. The new explicit default is `gemini-3.5-flash-lite`; select a different supported model through `GEMINI_MODEL` after checking quality, price, quota and privacy terms. No provider or model is represented as permanently free or universally best.

## Validation

74 existing Node regressions pass. Seven Deno tests cover gateway boundaries, provider routing, metadata-only probes, key redaction, supported output parsing, rate-limit errors, tenant/role denial and missing-key behaviour. Database transaction tests verify per-user/per-institution budgets and cross-tenant denial, along with previous academic access-control tests. SQL fixtures are rolled back.

Browser viewport smoke script: `scripts/noor-ai-workspace-smoke.mjs`. Local Chromium download failed in the execution environment, so its desktop/mobile viewport results are pending; do not treat static/DOM checks as visual browser verification.
