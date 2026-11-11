# NOOR Custom MCP

This is the initial authenticated, read-only NOOR MCP endpoint. It is intentionally **disabled by default** and is not yet approved for customer rollout.

## Security gates

- Set `NOOR_MCP_ENABLED=true` only in an isolated staging/test deployment after reviewing the code and tests.
- Set `NOOR_MCP_ALLOWED_ORIGINS` to a comma-separated list of exact HTTPS origins used by NOOR web clients. Do not use wildcards. Native/server-side MCP clients without an `Origin` header are supported.
- Keep Supabase Edge Function JWT verification enabled (`verify_jwt=true`).
- Configure `SUPABASE_URL` and the project's publishable/anon key. Do not configure or use a service-role key in this function.
- All data queries use the authenticated NOOR user's JWT and therefore remain subject to existing Supabase RLS.
- Request bodies are capped at 64 KiB. Only JSON POST requests are accepted. Invalid Origin, invalid credentials, unsupported protocol versions, and malformed requests are rejected.
- No MCP session IDs are issued; the server is stateless. GET/DELETE are intentionally not supported for this stateless endpoint.

## Current tools (read-only)

- `noor_list_my_institutions`: active institutions connected to the authenticated user and their role.
- `noor_get_attendance_summary`: a student's own attendance or aggregate attendance for an institution leader.
- Teacher and faculty attendance summaries are blocked until teacher-to-class authorization is explicitly enforced.
- Student personal attendance is restricted by both the membership filter and the database's existing RLS policy.
- Date boundaries are UTC calendar dates in this first version.

## Local validation

Run unit tests without network access:

```sh
deno test supabase/functions/noor-mcp/security_test.ts
```

Type-check the Edge Function:

```sh
deno check supabase/functions/noor-mcp/index.ts
```

## Staging smoke test

Use a dedicated staging project and test accounts only. Never paste access tokens into source control or chat.

Required environment variables:

- `NOOR_MCP_TEST_ENDPOINT`: deployed staging function URL.
- `NOOR_MCP_TEST_STUDENT_TOKEN`: access token for a staging student in institution A.
- `NOOR_MCP_TEST_PRINCIPAL_TOKEN`: access token for a staging principal in institution B.
- `NOOR_MCP_TEST_OTHER_INSTITUTION_ID`: institution B UUID, to verify student A cannot query it.

Run:

```sh
deno test --allow-env --allow-net supabase/functions/noor-mcp/smoke_test.ts
```

The smoke test checks unauthenticated rejection, bad-Origin rejection, initialization, tool discovery, role-scoped tool access, and cross-institution denial. It performs no writes.

## Customer-facing OAuth rollout (not implemented yet)

Before ChatGPT, Claude, or Gemini customers connect:

1. Configure Supabase Auth OAuth 2.1 / OIDC for NOOR with Authorization Code + PKCE.
2. Build the NOOR authorization/consent page. Show the client name, requested access and institution context; let the signed-in user approve or deny.
3. Ensure OAuth-issued access tokens still resolve to the same NOOR user and RLS scope. Never let an LLM choose or impersonate a user.
4. Add per-client consent/revocation and narrow scopes for each operation.
5. Add shared, persistent rate limiting and security audit events.
6. Run the staging smoke test with separate student, teacher, principal and cross-institution accounts.
7. Only then enable the endpoint in production and publish its URL.

Supabase's OAuth 2.1 server supports Authorization Code + PKCE, refresh tokens, dynamic client registration and MCP authentication. The NOOR consent UI and authorization configuration still need to be implemented and verified.

## Write operations (future phase)

Write tools are deliberately absent. Before adding any mutation (for example, mark attendance, publish a notice, create an assignment or update a timetable), implement and test:

- role + institution + class/section scoped authorization on every call;
- server-side validation and allowlisted fields;
- atomic database operations with safe idempotency keys;
- immutable audit events containing actor, institution, action and target;
- explicit user confirmation for consequential actions;
- duplicate/replay protection and shared rate limiting;
- negative tests proving that students, teachers and users in another institution cannot exceed their permissions.

Never expose service-role keys, Gemini/Claude/ChatGPT credentials, or Brevo API keys through MCP tools or client responses.
