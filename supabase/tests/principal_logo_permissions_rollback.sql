BEGIN;
CREATE TEMP TABLE noor_logo_ids(k text PRIMARY KEY,v uuid DEFAULT gen_random_uuid());
INSERT INTO noor_logo_ids(k) VALUES('principal'),('student'),('teacher'),('manager'),('other'),('school'),('other_school'),('class'),('section');
CREATE TEMP TABLE noor_logo_checks(name text,ok boolean);
GRANT SELECT ON noor_logo_ids TO authenticated;
GRANT INSERT,SELECT ON noor_logo_checks TO authenticated;
INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data)
 SELECT v,'logo-test-'||v||'@example.invalid',now(),'{"full_name":"Logo permission test"}','{}' FROM noor_logo_ids WHERE k IN('principal','student','teacher','manager','other');
INSERT INTO public.institutions(id,name,slug,institution_type,status,created_by)
 SELECT v,'Logo QA School','logo-qa-'||v,'school','active',(SELECT v FROM noor_logo_ids WHERE k='principal') FROM noor_logo_ids WHERE k IN('school','other_school');
INSERT INTO public.institution_memberships(institution_id,user_id,role,status,joined_at)
 SELECT s.v,u.v,x.role,'active',now() FROM (VALUES('school','principal','principal'),('school','student','student'),('school','teacher','teacher'),('school','manager','school_admin'),('other_school','other','principal'))x(s,u,role) JOIN noor_logo_ids s ON s.k=x.s JOIN noor_logo_ids u ON u.k=x.u;
INSERT INTO public.academic_groups(id,institution_id,name,group_type,parent_group_id,is_active)
 SELECT c.v,s.v,'Class 8','class',NULL,true FROM noor_logo_ids c,noor_logo_ids s WHERE c.k='class' AND s.k='school';
INSERT INTO public.academic_groups(id,institution_id,name,group_type,parent_group_id,is_active)
 SELECT sec.v,s.v,'A','section',c.v,true FROM noor_logo_ids sec,noor_logo_ids s,noor_logo_ids c WHERE sec.k='section' AND s.k='school' AND c.k='class';
SELECT set_config('request.jwt.claims',json_build_object('sub',(SELECT v FROM noor_logo_ids WHERE k='principal'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
INSERT INTO public.institution_branding(institution_id,logo_path) SELECT v,v||'/logo-qa.png' FROM noor_logo_ids WHERE k='school';
INSERT INTO storage.objects(bucket_id,name) SELECT 'noor-school-logos',v||'/logo-qa.png' FROM noor_logo_ids WHERE k='school';
INSERT INTO noor_logo_checks VALUES('principal can save logo and object',true);
RESET ROLE;
DO $$ DECLARE actor text; BEGIN
 FOREACH actor IN ARRAY ARRAY['student','teacher','manager','other'] LOOP
  PERFORM set_config('request.jwt.claims',json_build_object('sub',(SELECT v FROM noor_logo_ids WHERE k=actor),'role','authenticated')::text,true);
  SET LOCAL ROLE authenticated;
  BEGIN
   INSERT INTO storage.objects(bucket_id,name) SELECT 'noor-school-logos',v||'/forbidden-'||actor||'.png' FROM noor_logo_ids WHERE k='school';
   RAISE EXCEPTION 'Non-principal uploaded logo';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  WITH changed AS (UPDATE public.institution_branding SET logo_path=(SELECT v||'/forbidden.png' FROM noor_logo_ids WHERE k='school') WHERE institution_id=(SELECT v FROM noor_logo_ids WHERE k='school') RETURNING *)
  INSERT INTO noor_logo_checks SELECT actor||' cannot update logo',count(*)=0 FROM changed;
  RESET ROLE;
 END LOOP;
END $$;
SELECT set_config('request.jwt.claims',json_build_object('sub',(SELECT v FROM noor_logo_ids WHERE k='student'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
SELECT public.noor_select_student_section((SELECT v FROM noor_logo_ids WHERE k='school'),(SELECT v FROM noor_logo_ids WHERE k='class'),(SELECT v FROM noor_logo_ids WHERE k='section'));
INSERT INTO noor_logo_checks SELECT 'student class and section saved',count(*)=2 FROM public.academic_group_memberships WHERE membership_id IN(SELECT id FROM public.institution_memberships WHERE user_id=auth.uid()) AND status='active';
RESET ROLE;
SELECT set_config('request.jwt.claims',json_build_object('sub',(SELECT v FROM noor_logo_ids WHERE k='teacher'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
SELECT public.noor_select_teacher_section((SELECT v FROM noor_logo_ids WHERE k='school'),(SELECT v FROM noor_logo_ids WHERE k='class'),(SELECT v FROM noor_logo_ids WHERE k='section'));
INSERT INTO noor_logo_checks SELECT 'teacher section saved without broad class grant',count(*)=1 FROM public.academic_group_memberships WHERE membership_id IN(SELECT id FROM public.institution_memberships WHERE user_id=auth.uid()) AND status='active';
RESET ROLE;
SELECT jsonb_agg(jsonb_build_object('name',name,'ok',ok)) AS checks FROM noor_logo_checks;
ROLLBACK;
