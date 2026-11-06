# Principal and learning workspace update — 2026-11-06

Destination repository: `Noormanagement43/NOORMANAGEMENT`.
Destination Supabase project: `ayrryemawwplguaauxij` only.

## User-visible behavior

- Principal navigation has Dashboard, Staff, Students, Calendar, Notices & Meetings, Parent Communication and Settings, in that order. Classes/sections and school period defaults remain available under Settings → School setup.
- Staff keeps Refresh and access management, removes date/apply controls, and searches names, roles, subjects, class and section labels.
- Notices & Meetings has Notice, Meeting and Email entry points. All three deliver to the selected **in-app** school audience. This update does not send external email or replace the existing Brevo backend. Meeting messages also appear in the school calendar; earlier calendar events are preserved.
- A top-bar notification button shows unread school messages. Message audiences and read receipts are enforced by database RLS.
- Teachers explicitly start/finish their own periods. The saved daily status drives the green progression rail and principal/student period states. A passing clock does not mark a lesson complete.
- Student class results default to the enrolled section. The database rejects a student requesting the parent class or another class. Cohort counts/averages include the permitted class; individual classmates' private results remain hidden.
- Smart Notes supports private board/note photos plus text. Students in the permitted class can open the published photo using a short-lived signed URL.
- Weekly Planner supports seven dated subject/day cards, a photo and later editing. Weekly plans remain private to their teacher.
- Today's Note includes class-wide or individually targeted assignments with deadlines. The standalone Tasks & Deadlines navigation item is removed.
- Student encouragement changes with the school's date. Settings includes Simple & Clean alongside existing themes. Sidebar and teacher quick-action icons use consistent SVGs.
- Staff syllabus percentages are not fabricated from lesson completion. With no saved syllabus definition, Staff honestly shows “Syllabus not set”.

## Database deployment order

Applied to the destination project without deleting existing school records:

1. `supabase/new-project/communication_learning_polish.sql`
2. `supabase/new-project/student_class_result_guard.sql`
3. `supabase/new-project/weekly_photo_owner_guard.sql`
4. `supabase/new-project/recipient_validation_rls_guard.sql`

The recipient trigger validates enrollment as a narrowly scoped definer function; existing learning write RLS still authorizes the teacher and group. Trigger execution is not exposed as a public RPC. Weekly photo paths must belong to the author, preventing a plan from referencing another author's private photo.

## Verification

- `node --test tests/*.test.mjs`: 215 passing.
- All root JavaScript files and inline application scripts pass syntax checking.
- `supabase/tests/communications_learning_rollback.sql` executed against the destination project: audience filtering, unauthorized broadcasting/read receipts, recipient validation, student-only result scope, cohort averages, targeted assignment/photo isolation, private weekly-plan photos, cross-school denial and persisted progress synchronization passed.
- Every synthetic test record was rolled back; remaining test users: 0. No external emails were sent.
- Security advisor: no new RLS findings. Existing Auth warning: leaked-password protection disabled; enable in Supabase Auth if supported by the project's plan.
- Signed-in principal/teacher/student visual walkthrough and actual image upload/download over Storage HTTP are not verified in this session. Database Storage read policies were exercised using synthetic object metadata inside the rollback transaction.
