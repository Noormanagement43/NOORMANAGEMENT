# NOOR live provider verification — 4 November 2026

These are real server-side provider responses, not mocked tests or assumptions based on secret timestamps. Tests ran around 3:20–3:22 PM India time in project `ayrryemawwplguaauxij`.

| Provider | Saved secret detected/matched | Live API authentication | Generation / delivery | Remaining issue |
|---|---|---|---|---|
| Gemini | Yes: `gemini` | HTTP 200, model access verified | Generated the expected `OK` reply | No connectivity issue found in this test |
| Groq | Yes: `groq` | HTTP 200 from the actual model catalogue | `openai/gpt-oss-120b` generated the expected `OK` reply | Initial metadata URL returned 404; the production probe is corrected to validate the catalogue |
| OpenAI | Yes: `chatgpt` | HTTP 200 from the OpenAI model API | Not attempted | `OPENAI_MANAGER_MODEL` is unset; model choice is deliberately required rather than silently enabling a paid model |
| Brevo | Yes: `brevo` | HTTP 401 | No email attempted or sent | Stored credential was rejected; `EMAIL_FROM` is also unset |

## What the Groq fix changes

The earlier metadata probe used a model-specific URL containing an encoded slash. A 404 there was not evidence of an invalid key. A live model-catalogue request authenticated successfully, confirmed the configured model exists and was followed by a successful generation. `providers.ts` now uses that catalogue for model verification and distinguishes unavailable models from invalid authentication. No fallback provider or different model was silently substituted.

## Brevo next action

Replace the value of the existing `brevo` secret in Supabase using a valid Brevo API credential. Do not paste it in chat or GitHub. A follow-up server-side classification of the Brevo error identified `API_KEY_NOT_FOUND_OR_INVALID`; raw error text was not returned or logged. This does not identify whether the value was copied incorrectly, revoked or is a different credential type. No value was inspected to guess its format.

A verified sender (`EMAIL_FROM`) and Supabase Auth SMTP/Send Email Hook configuration remain separate. This test does not prove sender verification, confirmation/recovery email delivery, or attendance/announcement delivery. Legacy email automation remains undeployed and requires its canonical data-contract work.

## How verification was performed safely

The connected deployment permission was used for an isolated, short-lived operator diagnostic. It accepted only a high-entropy operator proof whose SHA-256 digest and expiry were in the temporary deployment. The proof was not a provider key, was not returned in a response, was not committed, and has been removed from the workspace.

The diagnostic read the provider secrets only inside Supabase runtime, sent authenticated metadata requests to fixed official provider hosts, and used the harmless prompt “Reply with exactly OK” for the two configured model tests. It never queried the database, created users/institutions, relaxed RLS, invoked school-data tools, read student data or sent email. Brevo account response bodies were discarded, not returned or logged. Model output was reduced to success/expected-output flags.

The temporary function was replaced immediately afterward with a disabled HTTP 410 tombstone and Supabase JWT verification enabled. It now has no provider calls, secret lookups, operator proof or database access. Existing canonical application functions retained JWT and institution/role checks throughout. No general-purpose unauthenticated AI endpoint was created.

## Evidence and files

Sanitised provider results: `docs/verification/noor-provider-checks-20261104.json`. These contain flags, provider names, public model IDs and HTTP status codes only; no key values or account details.

Changed production logic: `supabase/functions/noor-v2-ai/providers.ts` (Groq metadata URL), with a regression test for catalogue access and missing-model reporting. The disabled diagnostic source is recorded at `supabase/functions/noor-provider-diagnostics/index.ts`.

A successful tiny generation is a connectivity check, not proof of production throughput, billing quota, academic correctness or readiness of all NOOR workflows. Existing onboarding/data-contract, email and task-worker gaps remain documented separately. No production database schema/data or Auth configuration was changed.
