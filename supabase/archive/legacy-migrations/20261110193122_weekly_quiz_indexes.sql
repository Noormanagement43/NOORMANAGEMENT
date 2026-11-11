create index noor_quiz_attempt_tenant_idx on public.noor_quiz_attempts(institution_id);
create index noor_quiz_attempt_reviewer_idx on public.noor_quiz_attempts(reviewed_by);
create index noor_quiz_creator_idx on public.noor_weekly_quizzes(created_by);
