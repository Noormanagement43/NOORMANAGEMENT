-- Applied to NOOR-AI Supabase on 2026-10-20.
-- Keep original role/ownership predicates intact, AND require a verified active school.
-- Important: prevents direct REST access to saved staff attendance/periods after school suspension.
DO $noor$
DECLARE p record;
BEGIN
 FOR p IN
   SELECT tablename, policyname, cmd, qual, with_check
   FROM pg_policies
   WHERE schemaname='public'
     AND tablename IN ('noor_teacher_periods','noor_teacher_period_runs','noor_staff_attendance')
 LOOP
   IF p.cmd = 'SELECT' OR p.cmd = 'DELETE' THEN
     EXECUTE format('ALTER POLICY %I ON public.%I USING ((%s) AND private.noor_active_school_access(school_id))',p.policyname,p.tablename,p.qual);
   ELSIF p.cmd = 'INSERT' THEN
     EXECUTE format('ALTER POLICY %I ON public.%I WITH CHECK ((%s) AND private.noor_active_school_access(school_id))',p.policyname,p.tablename,p.with_check);
   ELSIF p.cmd = 'UPDATE' THEN
     EXECUTE format('ALTER POLICY %I ON public.%I USING ((%s) AND private.noor_active_school_access(school_id)) WITH CHECK ((%s) AND private.noor_active_school_access(school_id))',p.policyname,p.tablename,p.qual,p.with_check);
   END IF;
 END LOOP;
END $noor$;