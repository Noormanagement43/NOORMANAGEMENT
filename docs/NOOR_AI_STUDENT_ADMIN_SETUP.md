# NOOR AI — Student registration & school admin setup

## Current delivery scope

This build replaces the role-switching prototype with an account-first school workspace. It includes a student registration form, named student dashboard, student profile, school roster, approval/status control, editable class and section lists, platform school creation, CSV export, and private student-photo upload flow. Supabase Auth, PostgreSQL, private Storage, and RLS are the intended live services.

The static site must not be described as production-connected until a dedicated NOOR AI Supabase project is created, the migration is applied, `config.js` is populated with that project's URL and **publishable** key, and the acceptance checks below pass. Never place a service-role key here.

## Safe setup sequence

1. Create a dedicated Supabase project named `NOOR AI` in the user's existing organisation. Do not reuse the Cozy & Co. or personal project.
2. Apply `app-starter/supabase/migrations/003_student_admin_workspace.sql` in the NOOR AI project's SQL editor (or through the Supabase migration tool after review).
3. Create the first trusted platform account in Supabase Authentication. Verify its email if confirmations are enabled.
4. Promote only that trusted account using the SQL editor, substituting the exact account email:

   ```sql
   update public.profiles
   set role = 'creator', status = 'active', full_name = 'NOOR AI Platform Creator', updated_at = now()
   where lower(email) = lower('YOUR-TRUSTED-LOGIN-EMAIL');
   ```

   Confirm that exactly one row was updated. Do not expose this role-promotion operation in public signup.
5. Put the project URL and browser-safe publishable key in `config.js`:

   ```js
   window.NOOR_CONFIG = {
     SUPABASE_URL: "https://YOUR_PROJECT_REF.supabase.co",
     SUPABASE_PUBLISHABLE_KEY: "sb_publishable_..."
   };
   ```
6. Sign in as the Creator, create the first school workspace, and share that school's generated join code privately with its students. Add its class and section names under **Classes & sections**.
7. Provision principal/teacher accounts through trusted administration, then set their role, school membership and status through an approved admin workflow. The first delivery does not include automated teacher invitation or password provisioning, so do not claim that flow exists yet.

## Student form fields

Full name, login email, mobile number, school name, school join code, roll number, class, section, parent/guardian name, photo (JPG/PNG/WebP up to 3 MB), and password. The auth trigger sets `role='student'` regardless of browser metadata. A valid school code plus valid class/section links and activates the record; otherwise it is kept pending for school review.

The student dashboard greets the student by their saved first name and displays school, roll number, class, section, mobile number, and parent/guardian. It shows an enrollment state rather than pretending a pending account is fully approved.

## Admin and teacher capabilities in this delivery

- School workspaces can be created by the trusted Platform Creator; school join codes are not included in the public school directory.
- Principal/Manager accounts can view their own school and the student roster allowed by RLS.
- Teachers can view and update student records only where a matching active class/section assignment exists.
- School staff can add/rename/archive classes and add/archive sections; those names populate student registration choices.
- Student identity, mobile, parent/guardian, roll number, class/section, status and avatar path are stored in the database, not local-storage demo records.
- Roster download exports the currently authorised roster to CSV.

## Known next-phase items (not represented as completed)

This delivery does not yet include attendance, tasks, marks, PDF progress reports, syllabus OCR, AI test-paper generation, real email alerts, teacher invitations, or a full multi-step school registration/onboarding wizard. Add these incrementally to the same database with their own RLS and acceptance tests.

## Acceptance checks before public launch

1. Student sign-up with a wrong join code is pending and cannot activate itself.
2. Correct join code and valid selected class/section produces a student profile and the dashboard says `Hello, <student first name>` after email verification and sign-in.
3. Duplicate roll numbers in one school/class/section fail at the database constraint.
4. A student cannot read another student's profile, alter role/status/school/roll/class/section, or change official records by calling the Data API directly.
5. An unassigned teacher cannot read/edit another class roster through UI or direct API calls.
6. A principal cannot read another school's roster or join code.
7. A photo upload is limited to image MIME types and 3 MB, saved in a private bucket, and signed URLs are only generated after authorised access.
8. Class/section additions and renames survive sign-out/sign-in and repopulate the registration form.
9. Run Supabase Security Advisors after the migration and test with separate student, teacher, principal and creator accounts.