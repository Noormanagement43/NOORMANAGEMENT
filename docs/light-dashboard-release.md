# Light dashboard refinement

The existing role dashboards retain their data-backed modules, history routes and school branding. Settings now labels the existing saved palettes as Sky Pearl (`porcelain-blue`), Sage Ivory (`sage-garden`) and Pearl Rose (`pastel-aurora`); no database migration or preference reset is needed. Existing themes and dark mode remain available.

Changes include readable text and touch targets, consistent identity-card portraits, school-local time greetings, a current/next teacher period card, and a read-only full-day schedule with teacher, subject, times, chapter and topic. Principal running-period subjects open the selected period's details. Student shortcuts explicitly include Smart Notes, Assignments and Weekly Test. Action Required uses loaded attendance and school task records, without estimating absent staff from missing check-ins.

Profile images and logos use the existing saved account assets. No generated people, sample school records, keys or QA fixtures are included in production. No authentication, role grants, database schema or record retention logic changes.

Validation: 312 Node regression/behavior checks pass, including school-time greeting boundaries, current-period boundaries, teacher ownership, student class filtering and read-only principal details. Isolated browser fixtures verified teacher full-day navigation, principal lesson drilldown and student timetable navigation, with 390px mobile layout inspection. These browser fixtures used illustrative data; authenticated production database flows were not independently exercised in this session.
