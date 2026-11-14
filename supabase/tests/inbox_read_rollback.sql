-- Verify the school inbox with synthetic rows; all changes roll back.
BEGIN;
CREATE TEMP TABLE inbox_ids(k text PRIMARY KEY,v uuid NOT NULL);
INSERT INTO inbox_ids SELECT k,gen_random_uuid() FROM unnest(ARRAY['principal','student','school','other_school','pm','sm','notice','staff_notice','other_notice']) k;
CREATE TEMP TABLE inbox_results(check_name text,passed boolean);
GRANT SELECT ON inbox_ids TO authenticated;
GRANT INSERT,SELECT ON inbox_results TO authenticated;
INSERT INTO auth.users(id,email,raw_user_meta_data,raw_app_meta_data)
SELECT v,'inbox-check-'||v::text||'@example.invalid','{"full_name":"Inbox verification"}'::jsonb,'{}'::jsonb FROM inbox_ids WHERE k IN ('principal','student');
INSERT INTO public.institutions(id,name,slug,institution_type,status,created_by)
SELECT v,'Inbox verification','inbox-check-'||v::text,'school','active',(SELECT v FROM inbox_ids WHERE k='principal') FROM inbox_ids WHERE k IN ('school','other_school');
INSERT INTO public.institution_memberships(id,institution_id,user_id,role,status)
SELECT m.v,(SELECT v FROM inbox_ids WHERE k='school'),u.v,x.role,'active' FROM (VALUES('pm','principal','principal'),('sm','student','student'))x(m,u,role) JOIN inbox_ids m ON m.k=x.m JOIN inbox_ids u ON u.k=x.u;
INSERT INTO public.noor_school_messages(id,institution_id,kind,title,body,audience,created_by) VALUES
((SELECT v FROM inbox_ids WHERE k='notice'),(SELECT v FROM inbox_ids WHERE k='school'),'notice','Student notice','First line'||chr(10)||'Second line',ARRAY['student'],(SELECT v FROM inbox_ids WHERE k='principal')),
((SELECT v FROM inbox_ids WHERE k='staff_notice'),(SELECT v FROM inbox_ids WHERE k='school'),'notice','Staff notice','Staff only',ARRAY['teacher'],(SELECT v FROM inbox_ids WHERE k='principal')),
((SELECT v FROM inbox_ids WHERE k='other_notice'),(SELECT v FROM inbox_ids WHERE k='other_school'),'notice','Other school','Private',ARRAY['student'],(SELECT v FROM inbox_ids WHERE k='principal'));
SELECT set_config('request.jwt.claims',json_build_object('sub',(SELECT v FROM inbox_ids WHERE k='student'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
INSERT INTO inbox_results SELECT 'student_sees_only_own_audience',count(*)=1 FROM public.noor_school_messages WHERE institution_id=(SELECT v FROM inbox_ids WHERE k='school');
INSERT INTO inbox_results SELECT 'other_school_hidden',count(*)=0 FROM public.noor_school_messages WHERE institution_id=(SELECT v FROM inbox_ids WHERE k='other_school');
INSERT INTO public.noor_message_reads(message_id,institution_id,membership_id)
SELECT (SELECT v FROM inbox_ids WHERE k='notice'),(SELECT v FROM inbox_ids WHERE k='school'),v FROM inbox_ids WHERE k='sm';
INSERT INTO inbox_results SELECT 'own_message_read_saved',count(*)=1 FROM public.noor_message_reads WHERE membership_id=(SELECT v FROM inbox_ids WHERE k='sm');
DO $$ BEGIN
 BEGIN
  INSERT INTO public.noor_message_reads(message_id,institution_id,membership_id) SELECT (SELECT v FROM inbox_ids WHERE k='staff_notice'),(SELECT v FROM inbox_ids WHERE k='school'),v FROM inbox_ids WHERE k='pm';
  RAISE EXCEPTION 'Someone else read receipt was allowed';
 EXCEPTION WHEN insufficient_privilege THEN INSERT INTO inbox_results VALUES('cannot_write_another_members_read',true);END;
END $$;
RESET ROLE;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM inbox_results WHERE NOT passed) THEN RAISE EXCEPTION 'Inbox verification failed'; END IF; END $$;
SELECT json_agg(inbox_results) AS verification FROM inbox_results;
ROLLBACK;
