# Online weekly quiz verification

Verified on 11 November 2026 against the destination backend with disposable teacher/student accounts in a separate test school.

## Live results

- Actual teacher and student password sign-in passed.
- Gemini generated a quiz through the deployed academic API; provider names were absent from its quiz response.
- Teacher publication and student access to only enrolled-class questions passed. Students were denied the private teacher key.
- A weekday submission was rejected by the Saturday date guard.
- The post-submission fixture was explicitly seeded using the production deterministic scorer to test review before Saturday. A real Saturday HTTP submission was not forced on Wednesday.
- Live Gemini short-answer checking passed after fixing transient-error retry and original question-number mapping.
- No marks were present before teacher approval. Student attempts to approve marks were denied.
- Teacher approval saved the correct student, subject, Saturday date and `weekly_quiz` category. The live fixture received 17 / 23; repeated approval produced the same result without duplicate marks.
- Direct student changes to submitted answers were denied.
- The student key was hidden before closing. Moving only the disposable quiz fixture to the previous Saturday verified compact-key release after closing.
- Moving the disposable student to another class hid the quiz and denied key access.
- After confirmation, the disposable test school, both test accounts and their quiz, submission, marks, sessions and institution-scoped audit records were permanently removed. A follow-up query verified zero test schools, quizzes, attempts, marks and accounts. The short-lived operator check remains disabled with JWT verification enabled.

## Fixes and validation

Gemini 502/503/504 responses use at most two retries with exponential delay, jitter and an overall 45-second bound. Auth/quota failures do not retry. No alternate provider or paid model is selected.

Short-answer checking uses a server-generated JSON schema keyed by the original question numbers, followed by score-bound validation. Teacher approval remains mandatory.

Objective submission scoring and database tests share one private deterministic scorer. Tests cover correct, wrong, unanswered, invalid choices and invalid answer types.

252 existing JavaScript tests, 11 backend tests, the DOM quiz-flow integration check and rollback-only database checks passed. The Chromium runner could not launch in this environment; DOM tests do not establish actual phone rendering quality. Live provider availability and free-tier quota remain external dependencies; manual teacher grading remains available.
