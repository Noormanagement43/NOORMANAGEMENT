-- Synthetic period setup verification; no fixture records persist.
BEGIN;
CREATE TEMP TABLE setup_ids(k text PRIMARY KEY,v uuid NOT NULL);
INSERT INTO setup_ids SELECT k,gen_random_uuid() FROM unnest(ARRAY['principal','teacher','school','other_school']) k;
CREATE TEMP TABLE setup_results(check_name text,passed boolean);
GRANT SELECT ON setup_ids TO authenticated;
GRANT SELECT,INSERT ON setup_results TO authenticated;
INSERT INTO auth.users(id,email,raw_user_meta_data,raw_app_meta_data)
SELECT v,'setup-check-'||v::text||'@example.invalid','{"full_name":"Setup verification"}'::jsonb,'{}'::jsonb FROM setup_ids WHERE k IN ('principal','teacher');
INSERT INTO public.institutions(id,name,slug,institution_type,status,created_by)
SELECT v,'Setup verification','setup-check-'||v::text,'school','active',(SELECT v FROM setup_ids WHERE k='principal') FROM setup_ids WHERE k IN ('school','other_school');
INSERT INTO public.institution_memberships(institution_id,user_id,role,status)
SELECT (SELECT v FROM setup_ids WHERE k='school'),v,k,'active' FROM setup_ids WHERE k IN ('principal','teacher');
SELECT set_config('request.jwt.claims',json_build_object('sub',(SELECT v FROM setup_ids WHERE k='principal'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
INSERT INTO public.institution_period_slots VALUES
((SELECT v FROM setup_ids WHERE k='school'),1,'08:00','09:00'),((SELECT v FROM setup_ids WHERE k='school'),2,'09:00','10:00');
-- The client orders later shifts from the last period backwards.
INSERT INTO public.institution_period_slots VALUES
((SELECT v FROM setup_ids WHERE k='school'),2,'10:00','11:00'),((SELECT v FROM setup_ids WHERE k='school'),1,'09:00','10:00')
ON CONFLICT(institution_id,period_number) DO UPDATE SET start_time=excluded.start_time,end_time=excluded.end_time;
INSERT INTO setup_results SELECT 'ordered_batch_shift_saved',count(*)=2 AND min(start_time)='09:00'::time AND max(end_time)='11:00'::time FROM public.institution_period_slots WHERE institution_id=(SELECT v FROM setup_ids WHERE k='school');
DO $$ BEGIN
 BEGIN
  INSERT INTO public.institution_period_slots VALUES
  ((SELECT v FROM setup_ids WHERE k='school'),3,'11:00','12:00'),((SELECT v FROM setup_ids WHERE k='school'),4,'10:30','11:30')
  ON CONFLICT(institution_id,period_number) DO UPDATE SET start_time=excluded.start_time,end_time=excluded.end_time;
  RAISE EXCEPTION 'Overlapping batch was accepted';
 EXCEPTION WHEN SQLSTATE '22023' THEN
  INSERT INTO setup_results SELECT 'invalid_batch_fully_rolled_back',count(*)=2 FROM public.institution_period_slots WHERE institution_id=(SELECT v FROM setup_ids WHERE k='school');
 END;
 BEGIN
  INSERT INTO public.institution_period_slots VALUES((SELECT v FROM setup_ids WHERE k='other_school'),1,'08:00','09:00');
  RAISE EXCEPTION 'Cross-school write was accepted';
 EXCEPTION WHEN insufficient_privilege THEN INSERT INTO setup_results VALUES('cross_school_denied',true); END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims',json_build_object('sub',(SELECT v FROM setup_ids WHERE k='teacher'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN
  INSERT INTO public.institution_period_slots VALUES((SELECT v FROM setup_ids WHERE k='school'),3,'11:00','12:00');
  RAISE EXCEPTION 'Teacher changed period setup';
 EXCEPTION WHEN insufficient_privilege THEN INSERT INTO setup_results VALUES('teacher_write_denied',true); END;
END $$;
RESET ROLE;
SELECT json_agg(setup_results) AS verification FROM setup_results;
ROLLBACK;
