# NOOR Custom MCP

This folder contains the first customer-facing MCP endpoint for NOOR.

## Endpoint
After deployment:
https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/noor-mcp

Transport: stateless MCP JSON-RPC over HTTP POST.

## Authentication
Send a valid NOOR Supabase user access token in the Authorization: Bearer header.
The function verifies the token with Supabase Auth and creates a Supabase client carrying that same user JWT. It does not use a service-role key; database queries remain subject to existing RLS policies.

## Initial read-only tools
- noor_list_my_institutions: active institutions for the authenticated user.
- noor_get_attendance_summary: own attendance for students; aggregate attendance for institution leaders.
- Teachers are deliberately denied institution-wide attendance until teacher-to-class scope is explicitly enforced.

## Deployment
1. Review this branch and run NOOR tests.
2. Confirm the Edge Function environment has SUPABASE_URL and SUPABASE_ANON_KEY (or SUPABASE_PUBLISHABLE_KEYS).
3. Deploy noor-mcp with JWT verification enabled.
4. Set NOOR_MCP_ALLOWED_ORIGIN to the exact NOOR app origin for browser-based clients.
5. Test with a dedicated test student and test principal in separate institutions.
6. Verify cross-institution access is denied before enabling external customer connections.

## Current limitations
- This first endpoint uses a NOOR Supabase user JWT as its bearer credential.
- OAuth 2.1 authorization/discovery and per-client consent/revocation are not implemented yet. Do not publish as a general ChatGPT/Claude/Gemini connector until that authorization layer is implemented and tested.
- Only read-only tools are exposed. Write tools must have role-specific authorization, audit logging, idempotency and explicit confirmation.
- Shared-store rate limiting is required before broad public rollout.
- No AI provider secrets or Brevo credentials are exposed through MCP.

## Security
- Never add service-role keys or Gemini/Claude/ChatGPT/Brevo secrets to browser code or MCP responses.
- Derive user identity from the verified token, never from tool arguments.
- Never trust institution_id alone; verify active membership and rely on RLS.
