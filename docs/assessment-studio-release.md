# Assessment studio — 11 November 2026

Assignments now contains Weekly Test, Monthly Test and configured school exams. Principals save category-specific marks, question count, formats, difficulty and suggested duration under Subjects & Exams → Online Test Settings. Sections inherit class rules unless overridden. Weekly tests use Saturdays; monthly/exams accept their scheduled date.

Teachers can choose active classes and sections within their own school for tests, written assignments and today's homework. Homeroom attendance and My Class retain their existing scope. Up to eight syllabus images are compressed locally and sent to the authenticated backend. Generation returns editable questions, private answer keys, explanations and a syllabus/quality report. Teacher approval is required before publication.

Student papers use their school's logo/name and own class/section, with selectable MCQ/blank options, one-word and short answers, concept visuals and private profile-photo URLs. Desktop navigation sits beside the paper; phones use a navigation drawer and compact identity/marks strip. Drafts save on the current device and remain editable. Final submission is immutable.

Objective questions use deterministic approved-key scoring. Written answers enter a private durable grading queue; the authenticated grading service validates model output and atomically saves one category/subject/date result. The worker retries queued jobs every minute, with leases, bounded attempts and teacher fallback. Answer keys and worker credentials are not exposed to students. Existing legacy quizzes keep their existing approval behaviour.

Validation: 255 JavaScript tests, 15 backend tests, DOM integration through authoring/approval/student submission/results, and rollback-only live SQL integration for school/class boundaries, principal rules, immutable submission, queue leases, score validation and idempotent result creation. Deployed grading endpoint rejects anonymous requests with HTTP 401; scheduled worker is active. No permanent test students or quiz records were created. Mobile layout is CSS/DOM-verified; no authenticated real-device visual test was available in this environment.

Suggested duration is informational, not an enforced countdown. Drafts are local to one device. Model availability/quota can delay written marks; answers remain saved and the teacher can review submissions. Teacher review of generated questions/keys remains necessary for academic accuracy.
