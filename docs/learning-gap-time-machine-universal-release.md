# Learning Gap Time Machine — Universal School & College Rollout

## Scope
The system now supports every **existing authorized academic group** in NOOR: Nursery, LKG, UKG, Classes 1–10 and any school-defined college class/stream. Teachers can configure concepts, curriculum versions, subjects and prerequisite links without creating duplicate schools, students or classes.

For early years, teachers collect three short playful observations per check. Older learners use mapped approved quizzes and teacher-reviewed diagnostics; grades never depend on a single wrong answer.

## Architecture
- Existing institution/member/group identifiers are reused.
- Supabase Postgres stores concepts, dependencies, question-level evidence, cautious mastery estimates, teacher-reviewed findings, plans, reassessments, timelines and AI audit records.
- All 11 public tables enable RLS. Student sees only own data; teachers only their enrolled sections; linked parents only verified children's approved learning data. Principal summary is aggregate.
- The existing React/HTML dashboard sidebar was not replaced. A small launcher integrates with existing role views, with white-label themes.
- AI gateway `noor-learning-ai` runs in Supabase Edge Functions with JWT verification and per-school authorization; no credentials are shipped to clients.
- AI provider route: Groq primary, Gemini configured fallback, OpenAI only with explicit opt-in. Provider names are absent from learner interfaces.
- Generation is explicit, budgeted and teacher-reviewed; insufficient or inconsistent evidence is never called confirmed.
- The privacy gateway sends approved concept/subject context and pseudonymous assessment figures, not student names, contact details or private teacher notes.

## Deployment record (2026-11-17)
- Production Supabase migration applied as **20261117121344_noor_learning_gap_time_machine_universal**.
- Production RLS + teacher/learner recovery test suite: `supabase/tests/learning-gap-time-machine-rls.sql`, run transactionally with ROLLBACK. Includes cross-school access, unauthorized sections, guardian links, duplicate quiz ingestion, prerequisite graph cycles, teacher diagnostic/assignment, learner completion and independent reassessment.
- Frontend GitHub Actions: `NOOR static quality checks` and `NOOR Learning Intelligence quality gates`, including Deno typecheck, provider JSON validator tests, no fake concept/evidence references.
- AI gateway deployed with JWT verification.
- GitHub Pages hosts the public frontend via `.github/workflows/pages.yml`.

## Important boundaries
- This creates a **configurable platform**, not an exhaustive curated syllabus for every board and college course. Teachers must supply/approve topics and mapping. Do not auto-generate or pretend a school uses a particular curriculum.
- Student assignment completion does not equal mastery; a teacher must review a separate reassessment to resolve a gap.
- Confidence is a cautious support estimate; it is not a diagnosis, final academic decision or guaranteed prediction.
- Existing quizzes and grades are never rewritten. All new event timestamps reflect stored actual events.
- Parent summaries offer English/Urdu/Telugu/Hindi guidance. Complete school-provided topic translation is not automatically guaranteed.
- The product is designed for modern mobile screens, but real device validation with representative roles remains important.
- The applied backend migration is additive. Retain school records, archive retention decisions carefully, and do not drop evidence to roll back UI.

## Operational rollback
1. Disable `learning_gap_time_machine` globally using Creator feature controls. School leadership can also independently disable its school setting.
2. Revert the relevant GitHub Pages frontend commit / deployment. Keep the database schema in place while safe to do so; losing data is not necessary to disable feature use.
3. Disable/delete `noor-learning-ai` only with explicit release authorization; manual teacher workflow remains functional without AI.
4. If schema rollback is genuinely required, export/retain evidence and audit logs, review table dependencies, and create a separate reversible migration. Do not automatically drop student data.

## Follow-up educational validation
- Test representative age groups and college streams with their *own* approved syllabus, not assumed examples.
- Review accessibility, translation accuracy, phone interaction, teacher workload and fairness with real consenting pilot users before expanding AI dependence.
- Run throughput/load tests for target school cohorts before declaring high-scale performance.
