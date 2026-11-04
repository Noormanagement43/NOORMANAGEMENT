# Password recovery — implementation and activation

## Implemented

- Existing login Forgot password action opens forgot-password.html.
- Dedicated recovery screen requests a Supabase recovery email, verifies its numeric OTP with type=recovery, and updates the password only for the verified session identity.
- Email reset links are also supported; recovery uses an isolated in-memory client session, not the regular workspace login session.
- Confirmation, minimum/maximum length, invalid/expired code feedback, one-minute client resend cooldown, concurrent request protection, global sign-out after success, and accurate sign-out failure messages.
- No custom OTP generation, privileged keys, password/OTP logging or storage, new accounts, tenant-role updates, schema or RLS changes.
- The previous index.html recovery-link handler remains for older links; session restore no longer opens a workspace while handling recovery.
- Branded Supabase email template: supabase/templates/recovery.html (real {{ .Token }} plus {{ .ConfirmationURL }}).

## Required dashboard activation — not completed

The connected Supabase toolset cannot read or update hosted Auth SMTP, URL allowlist or templates. Edge Function secrets do not configure these Auth settings. No live recovery email, OTP verification or production password change has been tested.

1. Brevo: select and verify the intended sending identity/domain. Use Brevo SMTP credentials for custom SMTP, not the Brevo REST API key or MCP token. No credentials should be pasted into chat or committed.
2. Supabase Authentication → Email → SMTP Settings: enable custom SMTP and enter Brevo-provided host, port, SMTP login and SMTP key, plus verified sender name/email. Take values from the account dashboard; do not guess the SMTP login.
3. Supabase Authentication → URL Configuration: Site URL https://noormanagement43.github.io/NOORMANAGEMENT/; allow both that URL and https://noormanagement43.github.io/NOORMANAGEMENT/forgot-password.html. Preserve any other legitimate existing redirect URLs.
4. Supabase Authentication → Email Templates → Reset password: set subject NOOR — Reset your password; paste supabase/templates/recovery.html. Saving this repository file does not update the hosted template.
5. Check email OTP expiry/rate limits and enable appropriate password security and password-change notifications. Do not relax existing security settings to make a test pass.
6. After the frontend deployment, perform an end-to-end test on an explicitly approved test account: request email, verify actual inbox delivery, enter OTP, choose a new password, confirm old password fails/new succeeds; also test expired/reused code and resend limits. Do not change a real user's password as an automated test.

## Validation

Node regression tests cover existing application syntax/security checks and recovery API calls, identity checks, expired code, invalid password, cooldown, concurrency and failed network/provider responses. These mocks do not prove hosted email delivery. No live user data changed.

## Other integration work

Brevo REST authentication and Brevo MCP handshake/tool listing were verified earlier. Email notifications still require a canonical institution-scoped recipient adapter/queue and sender configuration; the legacy noor-school-automation function must not be enabled against obsolete tables. WhatsApp Business onboarding, approved templates and consent remain necessary. Per-institution external account ownership and scoped MCP task execution are not yet enabled.

References: https://supabase.com/docs/guides/auth/auth-email-templates and https://supabase.com/docs/guides/auth/auth-smtp
