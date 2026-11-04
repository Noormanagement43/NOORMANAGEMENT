# Brevo MCP backend connection — 2026-11-04

The saved MCP token authenticated successfully against the official fixed Brevo endpoint. Initialization and tool discovery passed; the first tools/list page returned 291 tool definitions. No tools/call request, messages, contact records or student data were used. This verifies connectivity, not individual tool permissions or email delivery.

The NOOR backend now supports POST action `brevo.mcp.check` with an institution_id and an active leadership JWT, and internal MCP tool `noor_check_brevo_connection`. Both return sanitized flags and the first-page tool count. The endpoint is fixed to https://mcp.brevo.com/v1/brevo/mcp; caller-provided endpoints, headers and arbitrary tool execution are not accepted. JSON/SSE, session IDs, negotiated protocol, timeouts, response limits and redirect rejection are implemented.

Secret names are matched server-side only. Preferred name: BREVO_MCP_TOKEN. Existing Brevo/Brivo plus MCP/MCB spellings with spaces, underscores or hyphens and optional token/key/api-key suffix are accepted. Different values across aliases fail closed. The REST `brevo` key is never reused as the MCP token. No credentials or tool descriptions are returned or logged.

Existing `brevo` REST authentication also returned HTTP 200 during the prior live check. EMAIL_FROM was absent; email sending has not been tested. Supabase Auth SMTP and WhatsApp Business onboarding are separate configuration tasks. Saving an MCP token does not enable arbitrary AI actions, tenant-specific Brevo account access, or ChatGPT OAuth connection. These require explicit scoped adapters and account ownership mapping before tools/call can be exposed.

No database schema, data or RLS changes. Existing gateway JWT checks remain enabled. The short-lived operator diagnostic used an expiring high-entropy proof, then was restored to a disabled JWT-protected tombstone. Test proof deleted.

Validation: Deno type check, gateway boundary/authorization tests and six MCP tests; static Node regression suite. Live results: docs/verification/noor-brevo-mcp-20261104.json.
