# NOOR Platform Creator Dashboard

Entry point: `creator.html`. Uses the existing Supabase project and the same session-only storage key as the unified app. The school login links to the dedicated creator sign-in screen. All counts are calculated from canonical institutions/memberships, with School/College separation and private signed logos.

## Delivered

- Responsive burgundy/ivory desktop and mobile dashboard, institute details, message composer/history, feature controls, payment records/statements, support, activity and account security pages.
- Twenty-four feature controls with global defaults and per-institute overrides. Global updates can replace or preserve overrides; selected institute updates do not affect others.
- Reversible institute pause independent of membership or institution status. No data is deleted. Principal creator messages/support remain accessible while paused.
- Separate principal broadcasts and per-recipient reads; optional scheduled external email queue with provider acceptance statuses, bounded retries, claim locking and request idempotency.
- Opt-in payment reminders three days before the due date, created once per institute/due date. Requires a saved fee/due date and an authorized creator; no reminders are enabled by default.
- Manual payment recording, editable billing plans and printable subscription statements. Statements are explicitly not GST tax invoices. No payment gateway is implied.
- Password update and optional enforced authenticator MFA using Supabase Auth. No passwords in code or configuration.
- Creator access requires all of: configured user UUID, exact current verified email, trusted platform_owner assignment, and MFA when enabled. Neither client/user metadata nor a platform role alone grants Creator access.
- RLS read restrictions, write triggers (including definer RPC writes), checked analytics/test endpoints, feature enforcement in AI/email dispatch and guarded school UI/navigation.

## Creator activation

The owner supplied the authorized NOOR email. Its existing verified Supabase Auth account has been bound to `private.noor_creator_account` and assigned `platform_owner`. The configured email remains server-side, with no email hardcoded in the public source. Server authorization and Creator state retrieval passed for this identity; a different school account was denied. The existing password was not read or changed. The owner signs in privately with that password or uses password recovery. Enroll/verify MFA before requiring it.

## Deployment state

Database migrations were applied to ayrryemawwplguaauxij. The creator email worker is a separate token-protected service. Browser deployment uses the repository's existing GitHub Pages workflow. The owner explicitly approved public GitHub publication and live deployment. Publish this branch through the existing GitHub Pages workflow and verify the resulting deployment before reporting a live login URL.

## Verification

- 292 Node regression/model/access tests passed.
- Deno type checks passed for the creator mail worker, existing school mail worker and AI endpoint. 27 backend tests passed, including disabled AI/email and paused billing scenarios.
- Desktop and 390px mobile browser QA used isolated local sample data, never production fixture rows.
- Live transactional checks passed: ordinary principal denied Creator identity/API; cross-institute access denied; analytics OFF blocks direct RPC; institute pause removes school access while retaining principal creator inbox. All changes rolled back.
- Comprehensive owner-mutation test in `supabase/tests/creator_control_plane.sql` is prepared but not executed: the initial Auth fixture setup confirmation expired. Run in a suitable isolated test workflow or after arranging explicit fixture authorization; no test Auth users were created.
- Actual password-based owner login/MFA, end-to-end principal message delivery and external email receipt remain unverified. The account is now authorized; the frontend still needs publication approval. No real messages/payments/pauses were made.
- Existing security advisor warnings for pg_net schema and leaked-password protection are not introduced by this change.


## Automatic feature registration

`noor-feature-registry.js` is the shared declaration source for feature metadata,
canonical keys, navigation aliases and mixed launchers. Both the school app and
Creator entry point load it before their consumers. After verified Creator
sign-in, `noor_creator_register_features` syncs these declarations before loading
Creator state. The existing catalog-driven UI then renders their switches without
another UI edit. New defaults start ON to preserve the previously available
behavior. Repeated syncs preserve saved defaults, institute overrides, and pause
settings. Existing catalog entries are never deleted. Global changes preserve
school-specific overrides by default; replacing them remains an explicit option.

The registration wrapper uses security invoker; its private implementation checks
the existing configured, verified Creator identity and MFA requirement before
writing metadata. Anonymous and ordinary school identities cannot register or
change controls. No direct table grants, RLS policies or tenant lookup rules change.

When adding a feature:

1. Add its key, label, category, description and route aliases to the shared registry.
2. Enforce that same key in its server RPC/table policies and backend operations.
   Registration only creates controls; it cannot infer or generate authorization
   for arbitrary new backend code. Use `NOOR_PLATFORM_ACCESS.requireFeature(key)`
   for non-navigation launchers as an additional client guard.
3. Add behavior tests for its OFF path. Navigation coverage tests fail if a new
   destination in the main nav has no mapping or documented shell exemption.

Mixed Assignments/Smart Notes launchers remain available while either child is ON;
the disabled child's route is still blocked. Workspace home, account settings,
security audit and Help & Suggestions are documented shells that remain reachable.
Individual profile writes still honor `profile_edit`; school settings writes retain
their database guards. Support availability while an institute is paused is preserved.

Apply `20261113135206_creator_feature_registry.sql` before publishing the matching
frontend. Until that migration exists, Creator sign-in reports the RPC failure
instead of pretending registry sync succeeded. Existing frontend deployments do
not depend on this new RPC. `supabase/tests/feature_registry.sql` runs registration,
identity-denial, idempotency and setting-preservation checks in a rolled-back
transaction; it does not create Auth users or send messages.
