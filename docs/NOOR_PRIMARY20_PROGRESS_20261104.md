# NOOR — Primary 20 work tracker (4 November 2026)

This checklist distinguishes shipped code, existing but unverified features, and blocked external configuration. Do not claim production completion from a static code check.

| # | Task | Verified state | Evidence / next check |
|---|---|---|---|
| 1 | Brevo REST authentication | VERIFIED | Latest server-side Brevo report records REST HTTP 200 and MCP handshake success; EMAIL_FROM and actual email delivery remain unverified. See `docs/NOOR_BREVO_MCP_20261104.md`. |
| 2 | Forgot/reset password email | CODE IMPROVED; DELIVERY PENDING | Main index implements reset request, recovery form, and password change. New recovery-session guard prevents entering dashboard while recovering. Supabase Auth SMTP/actual mailbox delivery unverified. |
| 3 | OpenAI manager model | BLOCKED | API authentication succeeded; `OPENAI_MANAGER_MODEL` not configured. No paid model selected silently. |
| 4 | Dark buttons / contrast | CODE SHIPPED | `noor-palettes.css` adds focused dark-mode action colors and keyboard focus treatment; awaiting authenticated visual QA. |
| 5 | Teacher photo dimensions | CODE EXISTS; QA NEEDED | `noor-profile-portraits.css` defines moderate rectangular frames, mobile variants. Need screenshot acceptance. |
| 6 | Teacher period edit/save | BACKEND CODE EXISTS; QA NEEDED | `teacher-reference.js`, `noor-shared-timetable.js`, destination timetable; requires active teacher membership. |
| 7 | Teacher period completed indicator | QA NEEDED | Needs sign-in and period completion roundtrip. |
| 8 | Mobile back action | CODE EXISTS; QA NEEDED | `index.html` includes `noorGoBack` with browser `popstate` routing. |
| 9 | Quick actions work | CODE IMPROVED; E2E PENDING | Principal overview now has separate Notices and Meetings actions. Command Centre route creates a view if its panel is not yet mounted. Legacy data callers still need migration. |
| 10 | Profile photo upload & edit | PARTIAL | Main profile upload exists; teacher profile editor now loaded and uses palette tokens, but update path relies on legacy school schema. |
| 11 | Remove principal assignment | CODE EXISTS | Principal assignment workflow retired in `noor-teacher-setup.js`; actual UI navigation verification remains. |
| 12 | School branding | CODE EXISTS; QA NEEDED | `noor-school-branding.js` and unit tests; live account test required. |
| 13 | Classes 1–10 / A-B presentation | PARTIAL | UI/reference pieces exist; zero onboarded schools means no real data verification. |
| 14 | Student attendance graph UI | PARTIAL | UI code available, data integration not yet production tested. |
| 15 | Daily/weekly/monthly calendar | CODE EXISTS; QA NEEDED | `noor-school-calendar.js`; real events and role-scope testing required. |
| 16 | Notices & meetings navigation | UI FIX SHIPPED; QA PENDING | Separate Notices and Meetings quick-action buttons route to their respective views. Actual signed-in navigation still needs verification. |
| 17 | Responsive layouts | CODE SHIPPED; QA NEEDED | Existing responsive CSS plus latest narrow/mobile portrait adjustment. No cross-device visual QA. |
| 18 | Loading/errors and empty states | PARTIAL | Existing error/empty states; full UX pass pending. |
| 19 | All buttons integration tests | PARTIAL | Additional recovery, routing, palette, and editor regression tests added; latest GitHub static suite succeeded. No signed-in end-to-end browser run. |
| 20 | GitHub tests & deploy | VERIFIED | Final 2026-11-04 GitHub Pages and static quality GitHub Actions runs succeeded. |

## Additional primary fixes on main (4 November 2026)
- `index.html`: preserve password recovery until completion, prevent session restoration into dashboard during reset, hide stale recovery form on tab changes.
- `index.html`: add distinct Notices / Meetings quick actions and reliable Command Centre view creation.
- `tests/primary-ui-regression.test.mjs`: verify recovery guard and separate route wiring.
- Brevo authentication correction: latest report records REST HTTP 200 and successful MCP handshake; this does not establish actual email delivery.

## Verified changes on main
- `noor-palettes.css`: dark-mode contrast, accessible focus rings, mobile photo cropping.
- `teacher-profile-editor.js`: palette-aware modal styles for dark and light modes.
- `index.html`: activate teacher editor script and cache-bust updated stylesheet.
- `tests/primary-ui-regression.test.mjs`: add regression checks. After assertion correction, GitHub Actions static suite passes (77/77).

## Main constraints
Current Supabase project `ayrryemawwplguaauxij` has no institution and no institution memberships, so teacher/student/principal end-to-end flows cannot be truthfully marked passing. Main `index.html` still contains calls to legacy school schema absent from this project. Supabase Auth SMTP, verified sender and actual Brevo email delivery are not proven. Latest REST authentication is HTTP 200, distinct from delivery. Do not insert fake students, schools or send messages just to fill dashboards.

## Release verification
- GitHub Pages deploy: `https://github.com/Noormanagement43/NOORMANAGEMENT/actions/runs/41822115486` — success.
- Static quality: `https://github.com/Noormanagement43/NOORMANAGEMENT/actions/runs/41822115752` — success.
- Live site: `https://noormanagement43.github.io/NOORMANAGEMENT/`.
