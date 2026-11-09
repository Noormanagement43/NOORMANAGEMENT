-- Noor family follow-ups and opt-in teacher-review alerts.
-- NO external messages are sent by this schema or its triggers.
ALTER TABLE public.school_settings
 ADD COLUMN IF NOT EXISTS academic_alerts_enabled boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS academic_alert_threshold_pct numeric(5,2) NOT NULL DEFAULT 40
    CHECK (academic_alert_threshold_pct > 0 AND academic_alert_threshold_pct <= 100);

CREATE TABLE IF NOT EXISTS public.noor_parent_contact_logs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
 student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
 created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
 subject text NOT NULL CHECK(length(trim(subject)) BETWEEN 2 AND 180),
 message text NOT NULL CHECK(length(trim(message)) BETWEEN 2 AND 4000),
 contact_method text NOT NULL DEFAULT 'draft' CHECK(contact_method IN ('draft','phone','in_person','in_app')),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','contacted','follow_up','closed')),
 contacted_at timestamptz,
 follow_up_due date,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.noor_parent_contact_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_noor_parent_contact_logs_school_student ON public.noor_parent_contact_logs(school_id,student_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_noor_parent_contact_logs_creator ON public.noor_parent_contact_logs(created_by);

DROP POLICY IF EXISTS "noor_parent_contact_read" ON public.noor_parent_contact_logs;
CREATE POLICY "noor_parent_contact_read" ON public.noor_parent_contact_logs
 FOR SELECT TO authenticated
 USING(private.noor_active_school_access(school_id) AND
       private.noor_can_school_permission(school_id,'manage_notices'));
DROP POLICY IF EXISTS "noor_parent_contact_insert" ON public.noor_parent_contact_logs;
CREATE POLICY "noor_parent_contact_insert" ON public.noor_parent_contact_logs
 FOR INSERT TO authenticated
 WITH CHECK(created_by=(SELECT auth.uid()) AND private.noor_active_school_access(school_id)
  AND private.noor_can_school_permission(school_id,'manage_notices')
  AND EXISTS(SELECT 1 FROM public.profiles s WHERE s.id=student_id AND s.school_id=school_id AND s.role='student'));
DROP POLICY IF EXISTS "noor_parent_contact_update" ON public.noor_parent_contact_logs;
CREATE POLICY "noor_parent_contact_update" ON public.noor_parent_contact_logs
 FOR UPDATE TO authenticated
 USING(private.noor_active_school_access(school_id) AND private.noor_can_school_permission(school_id,'manage_notices'))
 WITH CHECK(private.noor_active_school_access(school_id) AND private.noor_can_school_permission(school_id,'manage_notices'));

CREATE TABLE IF NOT EXISTS public.noor_academic_support_alerts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
 student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
 assessment_id uuid NOT NULL REFERENCES public.school_assessments(id) ON DELETE RESTRICT,
 score_percentage numeric(5,2) NOT NULL CHECK(score_percentage BETWEEN 0 AND 100),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','reviewed')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(assessment_id,student_id)
);
ALTER TABLE public.noor_academic_support_alerts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_noor_support_alerts_school_status ON public.noor_academic_support_alerts(school_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_noor_support_alerts_student ON public.noor_academic_support_alerts(student_id);

DROP POLICY IF EXISTS "noor_academic_support_read" ON public.noor_academic_support_alerts;
CREATE POLICY "noor_academic_support_read" ON public.noor_academic_support_alerts
 FOR SELECT TO authenticated
 USING(private.noor_active_school_access(school_id)
  AND private.noor_can_school_permission(school_id,'view_academic_reports'));
DROP POLICY IF EXISTS "noor_academic_support_update" ON public.noor_academic_support_alerts;
CREATE POLICY "noor_academic_support_update" ON public.noor_academic_support_alerts
 FOR UPDATE TO authenticated
 USING(private.noor_active_school_access(school_id)
  AND private.noor_can_school_permission(school_id,'view_academic_reports'))
 WITH CHECK(private.noor_active_school_access(school_id)
  AND private.noor_can_school_permission(school_id,'view_academic_reports'));

CREATE OR REPLACE FUNCTION private.noor_raise_support_alert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $trigger$
DECLARE
 a public.school_assessments%ROWTYPE;
 enabled boolean;
 threshold numeric;
 pct numeric;
BEGIN
 SELECT * INTO a FROM public.school_assessments WHERE id=NEW.assessment_id AND school_id=NEW.school_id;
 IF NOT FOUND OR a.max_marks<=0 THEN RETURN NEW; END IF;
 SELECT COALESCE(s.academic_alerts_enabled,false), COALESCE(s.academic_alert_threshold_pct,40)
 INTO enabled,threshold FROM public.school_settings s WHERE s.school_id=NEW.school_id;
 IF NOT enabled THEN RETURN NEW; END IF;
 pct:=round((NEW.marks_obtained*100/a.max_marks)::numeric,2);
 IF pct < threshold THEN
   INSERT INTO public.noor_academic_support_alerts(school_id,student_id,assessment_id,score_percentage,status)
   VALUES(NEW.school_id,NEW.student_id,NEW.assessment_id,LEAST(pct,100),'open')
   ON CONFLICT(assessment_id,student_id) DO UPDATE
    SET score_percentage=EXCLUDED.score_percentage,status='open',updated_at=now();
 ELSE
   UPDATE public.noor_academic_support_alerts SET status='reviewed',updated_at=now()
   WHERE assessment_id=NEW.assessment_id AND student_id=NEW.student_id AND school_id=NEW.school_id;
 END IF;
 RETURN NEW;
END;
$trigger$;
REVOKE ALL ON FUNCTION private.noor_raise_support_alert() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS noor_assessment_support_alert ON public.assessment_results;
CREATE TRIGGER noor_assessment_support_alert AFTER INSERT OR UPDATE OF marks_obtained
 ON public.assessment_results FOR EACH ROW EXECUTE FUNCTION private.noor_raise_support_alert();

REVOKE ALL ON public.noor_parent_contact_logs,public.noor_academic_support_alerts FROM anon;
GRANT SELECT,INSERT,UPDATE ON public.noor_parent_contact_logs TO authenticated;
GRANT SELECT,UPDATE ON public.noor_academic_support_alerts TO authenticated;
