-- Fix student "Paper could not open": column reference "q.id" is ambiguous.
-- The PL/pgSQL quiz row variable q was shadowed by a SQL alias q in feature
-- control guards. Qualify the guard with a distinct alias without modifying
-- enrollment checks, paper visibility, answer keys, grading, or school RLS.
-- Safe to apply again; no data updates or permission changes.
do $fix_paper_alias$
declare
  fn regprocedure;
  definition text;
  old_fragment constant text := 'from public.noor_weekly_quizzes q where q.id=p_quiz and private.noor_feature_enabled(q.institution_id,case q.assessment_kind';
  new_fragment constant text := 'from public.noor_weekly_quizzes feature_quiz where feature_quiz.id=p_quiz and private.noor_feature_enabled(feature_quiz.institution_id,case feature_quiz.assessment_kind';
begin
  foreach fn in array array[
    'private.noor_paper_member(uuid)'::regprocedure,
    'private.noor_test_clock(uuid,jsonb)'::regprocedure,
    'private.noor_submit_quiz(uuid,jsonb)'::regprocedure
  ] loop
    definition := pg_get_functiondef(fn);
    if position(old_fragment in definition) > 0 then
      execute replace(definition, old_fragment, new_fragment);
    elsif position(new_fragment in definition) = 0 then
      raise exception 'Unexpected definition for %, refusing unsafe rewrite', fn;
    end if;
  end loop;
end;
$fix_paper_alias$;
