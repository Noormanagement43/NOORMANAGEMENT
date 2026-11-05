# Canonical login and school onboarding fix

## Verified diagnosis

The live destination project ayrryemawwplguaauxij has institutions and institution_memberships, not school_directory, schools or noor_create_school_owner. All three existing Auth users were email-confirmed and had signed in previously, but there were zero institutions and zero memberships. Successful authentication was therefore followed by missing-schema onboarding calls or a pending profile. No password reset or email-confirmation bypass is needed to repair this schema mismatch.

## Changes

- Keep the original login, forms, theme and role dashboards. For the destination project, capture login and signup submissions and use the existing canonical API functions.
- Skip the nonexistent public directory entirely; do not publish a new anonymous school directory or weaken RLS. Principals share a school joining link (School ID prefilled) and separate role-specific code.
- Use register_institution_for_current_user after verified login. Resume only a recent owner draft bound to the same auth UID/email. If no school draft exists, show an explicit Finish school setup form instead of pretending a school was created.
- Keep a valid authenticated account available while the user completes setup. Do not recreate an existing account or institution. Reject new-school recovery when an inactive membership exists.
- Use noor_join_institution for student/staff codes; the server determines the membership role. Do not submit an arbitrary privileged role. Joining requests are bound to the authenticated user.
- Generate actual backend joining codes using noor_rotate_join_code after successful creation. Remove old unsupported custom numeric-code inputs from canonical registration. Show school ID and student/teacher codes once, with a school-link copy action. Codes are not embedded in shared URLs.
- Resolve Creator only from trusted platform_roles (platform_owner/platform_admin), never email or user_metadata. Paused memberships remain blocked.
- Preserve recovery-session guards and existing student Today: Absent work.

## Validation and limits

All tests include existing regression checks plus canonical registration/join arguments, identity binding, paused membership protection, Creator authorization, and principal/teacher/student authenticated login routing with mocked Auth/database responses. SQL inspection confirmed authenticated users can execute registration/join RPCs and anonymous users cannot register. No schema, grants, Auth settings or real user data were changed.

Real credentialed school creation and all three dashboard smoke tests remain unverified: no user password was accessed and no production school/test membership was manufactured. The broader legacy academic pages still contain older-schema queries; this change fixes the login/onboarding connection, not every module's data adapter. SMTP/inbox delivery remains a separate unverified account setting.
