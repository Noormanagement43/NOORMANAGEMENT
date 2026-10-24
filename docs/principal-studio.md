# Principal dashboard repair

The deployment previously copied neither principal-studio.js nor the staff/teacher extension modules into the Pages artifact. A malformed command-centre CSS URL also swallowed the following stylesheet tag. The principal preview navigation was removed by the login navigation rebuild, and its observer re-rendered the entire dashboard whenever a control changed CSS classes.

This change deploys the required assets, repairs the stylesheet link, mounts the principal view on initial login and subsequent Overview navigation, and limits observation to route-container changes. Active principal/owner accounts in verified active schools can open it; pending or other-role accounts cannot render it. This client display guard does not replace the existing server RLS.

## Files

- index.html — existing authenticated application shell and routing.
- principal-studio.js — dashboard styling, rendering and local interactions.
- principal-mock-data.js — explicitly fictional chart data, never submitted to the database.
- preview/principal-dashboard-preview.html — isolated preview harness; no database client, login or API access.
- scripts/principal-studio-smoke.mjs — browser regression checks.
- .github/workflows/deploy-pages.yml — publishes the required files and runs the smoke test.

## Run

From the repository root: `python -m http.server 8060`. Open http://localhost:8060/preview/principal-dashboard-preview.html. For the signed-in app use index.html with the existing config and school account. No new key is needed for this frontend repair.

To test, install Playwright and Chromium in a test environment, then run `SITE_URL=http://localhost:8060/ node scripts/principal-studio-smoke.mjs`.

## Working in this release

- Colourful gradient KPI cards, different colours on each attendance/subject bar, donut, rings, table sparklines, responsive layouts and reduced-motion support.
- Weekly/monthly chart changes use different sample values.
- Professional SVG Jinni, opening/closing drawer with Escape and focus containment, tasks/notices/meetings, completion and snooze, local renaming.
- Per-account/per-school local widget order and width; drag handles and touch/keyboard-friendly move buttons.
- Excel-compatible CSV exports, browser Print/Save as PDF, sharing or clipboard fallback.
- Private management note drafts, offline status and local feedback drafts.
- Quick actions open existing permission-controlled school workflows; live records remain available through Open live school records.

## Explicit remaining integration work

The sample dashboard is a functional design preview, not a live analytics release. It does not send reminder notifications, schedule reports, provide weather, translate the interface, implement a document vault, or generate Gemini summaries. The existing live Command Centre has separate school record and automation workflows; those were not changed or revalidated here. The preview calendar marks Sundays plus the three fixed national holidays; a complete state/government holiday feed is not included. Sample health and predictive claims must not be used for school decisions. Local preferences and drafts do not sync across devices. PDF is browser print, CSV is Excel-compatible text rather than a native XLSX workbook.

No religion is inferred from a person's name. The default greeting remains time-based. A future explicit greeting preference can provide Assalamu Alaikum without profiling users.
