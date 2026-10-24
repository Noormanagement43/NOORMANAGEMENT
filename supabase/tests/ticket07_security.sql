DO $test$
DECLARE v_bad integer;
BEGIN
  IF private.is_creator() THEN RAISE EXCEPTION 'FAIL: unauthenticated SQL context is platform admin'; END IF;
  IF private.noor_active_school_access(gen_random_uuid()) THEN RAISE EXCEPTION 'FAIL: random school access was allowed'; END IF;
  IF private.noor_can_school_permission(gen_random_uuid(),'manage_staff') THEN RAISE EXCEPTION 'FAIL: random school management permission was allowed'; END IF;
  IF private.can_manage_class_context(gen_random_uuid(),gen_random_uuid(),NULL) THEN RAISE EXCEPTION 'FAIL: random class management was allowed'; END IF;
  IF private.noor_is_assigned_teacher(gen_random_uuid(),gen_random_uuid(),NULL,NULL) THEN RAISE EXCEPTION 'FAIL: random teacher assignment was allowed'; END IF;
  IF public.noor_is_platform_admin() THEN RAISE EXCEPTION 'FAIL: unauthenticated caller reported as platform admin'; END IF;
  IF has_function_privilege('anon','public.noor_create_school_owner(text,text,text)'::regprocedure,'EXECUTE') THEN RAISE EXCEPTION 'FAIL: anon can execute owner creation RPC'; END IF;
  IF has_function_privilege('anon','public.noor_accept_school_invitation(text)'::regprocedure,'EXECUTE') THEN RAISE EXCEPTION 'FAIL: anon can execute invitation acceptance RPC'; END IF;
  SELECT count(*) INTO v_bad FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity;
  IF v_bad>0 THEN RAISE EXCEPTION 'FAIL: % public tables have RLS disabled',v_bad; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='school_memberships_username_ci_unique') THEN RAISE EXCEPTION 'FAIL: school username uniqueness index missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='profiles_student_roll_context_unique') THEN RAISE EXCEPTION 'FAIL: student roll uniqueness index missing'; END IF;
  RAISE NOTICE 'PASS: no-auth privilege denial; random school/class access denied; anonymous owner/invitation RPC denied; all public tables have RLS; scoped username and roll uniqueness indexes exist.';
END;
$test$;