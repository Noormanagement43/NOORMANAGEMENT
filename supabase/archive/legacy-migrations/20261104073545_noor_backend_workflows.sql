-- New institution database only. No legacy import, demo users or provider credentials.
-- Reviewed against the live institution_id schema on 2026-11-04.
CREATE TABLE public.noor_audit_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 institution_id uuid NOT NULL REFERENCES public.institutions(id),
 actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 action text NOT NULL,
 entity_id uuid,
 metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (octet_length(metadata::text)<=4096),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX noor_audit_tenant_time ON public.noor_audit_events(institution_id,created_at DESC,id);
ALTER TABLE public.noor_audit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.noor_audit_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.noor_audit_events TO authenticated;
CREATE POLICY noor_audit_leadership_read ON public.noor_audit_events FOR SELECT TO authenticated
 USING (private.can_manage_academics(institution_id));

CREATE OR REPLACE FUNCTION private.noor_group_access(p_institution uuid,p_group uuid,p_write boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 SELECT private.can_manage_academics(p_institution) OR (
 private.is_active_member(p_institution) AND p_group IS NOT NULL AND EXISTS (
  SELECT 1 FROM public.academic_group_memberships gm
  JOIN public.institution_memberships m ON m.id=gm.membership_id AND m.institution_id=gm.institution_id
  WHERE gm.institution_id=p_institution AND gm.group_id=p_group AND gm.status='active'
   AND m.user_id=(select auth.uid()) AND m.status='active'
   AND (NOT p_write OR (gm.group_role IN ('teacher','faculty') AND m.role IN ('teacher','faculty')))
 ));
$$;
REVOKE ALL ON FUNCTION private.noor_group_access(uuid,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.noor_group_access(uuid,uuid,boolean) TO authenticated;

-- Assignment, smart note, revision material and recorded lesson metadata.
-- Storage URLs/secrets are not accepted: files use private bucket object paths.
CREATE TABLE public.noor_learning_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 institution_id uuid NOT NULL REFERENCES public.institutions(id),
 academic_group_id uuid NOT NULL,
 kind text NOT NULL CHECK (kind IN ('assignment','smart_note','revision','recorded_lesson')),
 title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 180),
 body text NOT NULL DEFAULT '' CHECK (length(body)<=50000),
 subject_name text NOT NULL CHECK (length(btrim(subject_name)) BETWEEN 1 AND 140),
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
 due_at timestamptz,
 attachment_path text CHECK (attachment_path IS NULL OR length(attachment_path)<=500),
 created_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,institution_id),
 FOREIGN KEY(academic_group_id,institution_id) REFERENCES public.academic_groups(id,institution_id)
);
CREATE INDEX noor_learning_group_feed ON public.noor_learning_items(institution_id,academic_group_id,status,created_at DESC,id);
CREATE INDEX noor_learning_author ON public.noor_learning_items(created_by);
ALTER TABLE public.noor_learning_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.noor_learning_items FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.noor_learning_items TO authenticated;
CREATE POLICY noor_learning_read ON public.noor_learning_items FOR SELECT TO authenticated USING (
 private.noor_group_access(institution_id,academic_group_id,true) OR
 (status='published' AND private.noor_group_access(institution_id,academic_group_id,false)));
CREATE POLICY noor_learning_create ON public.noor_learning_items FOR INSERT TO authenticated WITH CHECK (
 created_by=(select auth.uid()) AND private.noor_group_access(institution_id,academic_group_id,true));
CREATE POLICY noor_learning_edit ON public.noor_learning_items FOR UPDATE TO authenticated
 USING (private.noor_group_access(institution_id,academic_group_id,true) AND
 (created_by=(select auth.uid()) OR private.can_manage_academics(institution_id)))
 WITH CHECK (private.noor_group_access(institution_id,academic_group_id,true) AND
 (created_by=(select auth.uid()) OR private.can_manage_academics(institution_id)));
CREATE POLICY noor_learning_delete ON public.noor_learning_items FOR DELETE TO authenticated
 USING (status='draft' AND private.noor_group_access(institution_id,academic_group_id,true) AND
 (created_by=(select auth.uid()) OR private.can_manage_academics(institution_id)));

CREATE TABLE public.noor_assignment_submissions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 institution_id uuid NOT NULL REFERENCES public.institutions(id),
 learning_item_id uuid NOT NULL,
 student_membership_id uuid NOT NULL,
 answer text NOT NULL CHECK (length(answer) BETWEEN 1 AND 50000),
 submitted_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(learning_item_id,student_membership_id),
 UNIQUE(id,institution_id),
 FOREIGN KEY(learning_item_id,institution_id) REFERENCES public.noor_learning_items(id,institution_id),
 FOREIGN KEY(student_membership_id,institution_id) REFERENCES public.institution_memberships(id,institution_id)
);
CREATE INDEX noor_submission_student ON public.noor_assignment_submissions(institution_id,student_membership_id,submitted_at DESC);
ALTER TABLE public.noor_assignment_submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.noor_assignment_submissions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.noor_assignment_submissions TO authenticated;
CREATE POLICY noor_submission_read ON public.noor_assignment_submissions FOR SELECT TO authenticated USING (
 private.is_active_member(institution_id) AND (private.is_my_membership(student_membership_id) OR EXISTS (
 SELECT 1 FROM public.noor_learning_items l WHERE l.id=learning_item_id AND l.institution_id=noor_assignment_submissions.institution_id
 AND private.noor_group_access(l.institution_id,l.academic_group_id,true))));
CREATE POLICY noor_submission_create ON public.noor_assignment_submissions FOR INSERT TO authenticated WITH CHECK (
 private.is_active_member(institution_id) AND EXISTS (
 SELECT 1 FROM public.institution_memberships m WHERE m.id=student_membership_id
 AND m.institution_id=noor_assignment_submissions.institution_id AND m.user_id=(select auth.uid())
 AND m.status='active' AND m.role IN ('student','university_student')) AND EXISTS (
 SELECT 1 FROM public.noor_learning_items l WHERE l.id=learning_item_id
 AND l.institution_id=noor_assignment_submissions.institution_id AND l.kind='assignment' AND l.status='published'
 AND (l.due_at IS NULL OR l.due_at>=now()) AND private.noor_group_access(l.institution_id,l.academic_group_id,false)));

CREATE TABLE public.noor_assessment_results (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 institution_id uuid NOT NULL REFERENCES public.institutions(id),
 academic_group_id uuid NOT NULL,
 student_membership_id uuid NOT NULL,
 assessment_title text NOT NULL CHECK (length(btrim(assessment_title)) BETWEEN 1 AND 180),
 subject_name text NOT NULL CHECK (length(btrim(subject_name)) BETWEEN 1 AND 140),
 assessed_on date NOT NULL,
 marks numeric(8,2) NOT NULL CHECK(marks>=0),
 max_marks numeric(8,2) NOT NULL CHECK(max_marks>0 AND marks<=max_marks),
 feedback text NOT NULL DEFAULT '' CHECK(length(feedback)<=4000),
 graded_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(academic_group_id,institution_id) REFERENCES public.academic_groups(id,institution_id),
 FOREIGN KEY(student_membership_id,institution_id) REFERENCES public.institution_memberships(id,institution_id)
);
CREATE INDEX noor_results_student_date ON public.noor_assessment_results(institution_id,student_membership_id,assessed_on DESC,id);
CREATE INDEX noor_results_group ON public.noor_assessment_results(academic_group_id,institution_id);
CREATE INDEX noor_results_grader ON public.noor_assessment_results(graded_by);
ALTER TABLE public.noor_assessment_results ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.noor_assessment_results FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.noor_assessment_results TO authenticated;
CREATE POLICY noor_results_read ON public.noor_assessment_results FOR SELECT TO authenticated USING (
 private.is_active_member(institution_id) AND (private.is_my_membership(student_membership_id)
 OR private.noor_group_access(institution_id,academic_group_id,true)));
CREATE POLICY noor_results_create ON public.noor_assessment_results FOR INSERT TO authenticated WITH CHECK (
 graded_by=(select auth.uid()) AND private.noor_group_access(institution_id,academic_group_id,true));
CREATE POLICY noor_results_edit ON public.noor_assessment_results FOR UPDATE TO authenticated
 USING (private.noor_group_access(institution_id,academic_group_id,true))
 WITH CHECK (private.noor_group_access(institution_id,academic_group_id,true));

CREATE TABLE public.noor_calendar_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 institution_id uuid NOT NULL REFERENCES public.institutions(id),
 academic_group_id uuid,
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 1 AND 180),
 kind text NOT NULL CHECK(kind IN ('notice','meeting','exam','holiday','event')),
 description text NOT NULL DEFAULT '' CHECK(length(description)<=10000),
 starts_at timestamptz NOT NULL,
 ends_at timestamptz NOT NULL CHECK(ends_at>=starts_at),
 created_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(academic_group_id,institution_id) REFERENCES public.academic_groups(id,institution_id)
);
CREATE INDEX noor_calendar_tenant_date ON public.noor_calendar_events(institution_id,starts_at,id);
CREATE INDEX noor_calendar_group ON public.noor_calendar_events(academic_group_id,institution_id);
CREATE INDEX noor_calendar_author ON public.noor_calendar_events(created_by);
ALTER TABLE public.noor_calendar_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.noor_calendar_events FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.noor_calendar_events TO authenticated;
CREATE POLICY noor_calendar_read ON public.noor_calendar_events FOR SELECT TO authenticated USING (
 private.is_active_member(institution_id) AND (academic_group_id IS NULL OR private.noor_group_access(institution_id,academic_group_id,false)));
CREATE POLICY noor_calendar_create ON public.noor_calendar_events FOR INSERT TO authenticated WITH CHECK (
 created_by=(select auth.uid()) AND (private.can_manage_academics(institution_id)
 OR private.noor_group_access(institution_id,academic_group_id,true)));
CREATE POLICY noor_calendar_edit ON public.noor_calendar_events FOR UPDATE TO authenticated
 USING (private.can_manage_academics(institution_id) OR (created_by=(select auth.uid()) AND private.noor_group_access(institution_id,academic_group_id,true)))
 WITH CHECK (private.can_manage_academics(institution_id) OR (created_by=(select auth.uid()) AND private.noor_group_access(institution_id,academic_group_id,true)));
CREATE POLICY noor_calendar_delete ON public.noor_calendar_events FOR DELETE TO authenticated
 USING (private.can_manage_academics(institution_id) OR (created_by=(select auth.uid()) AND private.noor_group_access(institution_id,academic_group_id,true)));

CREATE OR REPLACE FUNCTION private.noor_student_enrolled(p_institution uuid,p_group uuid,p_member uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$ SELECT private.noor_group_access(p_institution,p_group,true) AND EXISTS (
 SELECT 1 FROM public.academic_group_memberships gm JOIN public.institution_memberships m
 ON m.id=gm.membership_id AND m.institution_id=gm.institution_id
 WHERE gm.institution_id=p_institution AND gm.group_id=p_group AND gm.membership_id=p_member
 AND gm.group_role='student' AND gm.status='active' AND m.role IN ('student','university_student') AND m.status='active'); $$;
REVOKE ALL ON FUNCTION private.noor_student_enrolled(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.noor_student_enrolled(uuid,uuid,uuid) TO authenticated;

-- Immutable identities on update; assessment targets must be enrolled students.
CREATE OR REPLACE FUNCTION private.noor_guard_academic_row()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.institution_id IS DISTINCT FROM OLD.institution_id
 OR NEW.academic_group_id IS DISTINCT FROM OLD.academic_group_id OR NEW.created_at IS DISTINCT FROM OLD.created_at) THEN
 RAISE EXCEPTION 'Academic record identity cannot be reassigned' USING ERRCODE='42501'; END IF;
 IF TG_TABLE_NAME='noor_assessment_results' THEN
  IF TG_OP='UPDATE' AND (NEW.student_membership_id IS DISTINCT FROM OLD.student_membership_id OR NEW.graded_by IS DISTINCT FROM OLD.graded_by) THEN
   RAISE EXCEPTION 'Assessment ownership cannot be reassigned' USING ERRCODE='42501'; END IF;
  IF NOT private.noor_student_enrolled(NEW.institution_id,NEW.academic_group_id,NEW.student_membership_id) THEN
   RAISE EXCEPTION 'Result requires an active student enrolled in this group' USING ERRCODE='23514'; END IF;
 ELSE
  IF TG_OP='UPDATE' AND NEW.created_by IS DISTINCT FROM OLD.created_by THEN
   RAISE EXCEPTION 'Author cannot be reassigned' USING ERRCODE='42501'; END IF;
  IF TG_TABLE_NAME='noor_learning_items' AND NEW.attachment_path IS NOT NULL
   AND (split_part(NEW.attachment_path,'/',1)<>NEW.created_by::text OR NEW.attachment_path LIKE '%..%') THEN
   RAISE EXCEPTION 'Attachment must belong to the author' USING ERRCODE='23514'; END IF;
 END IF;
 NEW.updated_at=now(); RETURN NEW;
END $$;
CREATE TRIGGER noor_learning_guard BEFORE INSERT OR UPDATE ON public.noor_learning_items FOR EACH ROW EXECUTE FUNCTION private.noor_guard_academic_row();
CREATE TRIGGER noor_results_guard BEFORE INSERT OR UPDATE ON public.noor_assessment_results FOR EACH ROW EXECUTE FUNCTION private.noor_guard_academic_row();
CREATE TRIGGER noor_calendar_guard BEFORE INSERT OR UPDATE ON public.noor_calendar_events FOR EACH ROW EXECUTE FUNCTION private.noor_guard_academic_row();

-- Provider registration is configuration metadata only, never OAuth tokens or API keys.
CREATE TABLE public.noor_connections (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 institution_id uuid NOT NULL REFERENCES public.institutions(id),
 provider text NOT NULL CHECK(provider ~ '^[a-z][a-z0-9_]{1,49}$'),
 label text NOT NULL CHECK(length(btrim(label)) BETWEEN 1 AND 120),
 enabled boolean NOT NULL DEFAULT false,
 created_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(institution_id,provider),
 UNIQUE(id,institution_id)
);
CREATE INDEX noor_connection_creator ON public.noor_connections(created_by);
ALTER TABLE public.noor_connections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.noor_connections FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.noor_connections TO authenticated;
CREATE POLICY noor_connections_read ON public.noor_connections FOR SELECT TO authenticated USING (private.can_manage_academics(institution_id));

-- Durable drafts: no external side effects or automatic approval, even from AI.
CREATE TABLE public.noor_workflow_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 institution_id uuid NOT NULL REFERENCES public.institutions(id),
 connection_id uuid NOT NULL,
 requested_by uuid NOT NULL REFERENCES auth.users(id),
 operation text NOT NULL CHECK(operation IN ('ai.generate','github.read','gmail.draft','brevo.draft','supabase.report')),
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object' AND octet_length(payload::text)<=16384),
 idempotency_key text NOT NULL CHECK(length(idempotency_key) BETWEEN 8 AND 120),
 state text NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','cancelled')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(institution_id,requested_by,idempotency_key),
 FOREIGN KEY(connection_id,institution_id) REFERENCES public.noor_connections(id,institution_id)
);
CREATE INDEX noor_jobs_tenant_created ON public.noor_workflow_jobs(institution_id,created_at DESC,id);
CREATE INDEX noor_jobs_connection ON public.noor_workflow_jobs(connection_id,institution_id);
CREATE INDEX noor_jobs_requester ON public.noor_workflow_jobs(requested_by);
ALTER TABLE public.noor_workflow_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.noor_workflow_jobs FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.noor_workflow_jobs TO authenticated;
CREATE POLICY noor_jobs_read ON public.noor_workflow_jobs FOR SELECT TO authenticated USING (private.can_manage_academics(institution_id));

CREATE TABLE private.noor_rate_limits (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 bucket text NOT NULL,
 window_start timestamptz NOT NULL,
 hits integer NOT NULL,
 PRIMARY KEY(user_id,bucket)
);
REVOKE ALL ON private.noor_rate_limits FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION private.noor_consume_limit(p_bucket text,p_limit int)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$ DECLARE v_hits int; v_start timestamptz:=date_trunc('minute',now());
BEGIN
 IF auth.uid() IS NULL THEN RETURN false; END IF;
 INSERT INTO private.noor_rate_limits(user_id,bucket,window_start,hits) VALUES(auth.uid(),p_bucket,v_start,1)
 ON CONFLICT(user_id,bucket) DO UPDATE SET window_start=v_start,
 hits=CASE WHEN private.noor_rate_limits.window_start=v_start THEN private.noor_rate_limits.hits+1 ELSE 1 END
 RETURNING hits INTO v_hits;
 RETURN v_hits<=p_limit;
END $$;
REVOKE ALL ON FUNCTION private.noor_consume_limit(text,int) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.noor_register_connection(p_institution uuid,p_provider text,p_label text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$ DECLARE v_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT private.can_manage_academics(p_institution) THEN RAISE EXCEPTION 'Institution leadership required' USING ERRCODE='42501'; END IF;
 IF NOT private.noor_consume_limit('register_connection',10) THEN RAISE EXCEPTION 'Rate limit exceeded' USING ERRCODE='54000'; END IF;
 INSERT INTO public.noor_connections(institution_id,provider,label,created_by)
 VALUES(p_institution,p_provider,p_label,auth.uid()) ON CONFLICT(institution_id,provider) DO UPDATE SET label=EXCLUDED.label RETURNING id INTO v_id;
 INSERT INTO public.noor_audit_events(institution_id,actor_id,action,entity_id) VALUES(p_institution,auth.uid(),'connection.registered',v_id);
 RETURN v_id;
END $$;
CREATE OR REPLACE FUNCTION public.noor_register_connection(p_institution uuid,p_provider text,p_label text)
RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.noor_register_connection(p_institution,p_provider,p_label); $$;

CREATE OR REPLACE FUNCTION private.noor_draft_workflow(p_institution uuid,p_connection uuid,p_operation text,p_payload jsonb,p_idempotency_key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$ DECLARE v_id uuid; v_provider text; v_existing public.noor_workflow_jobs;
BEGIN
 IF auth.uid() IS NULL OR NOT private.can_manage_academics(p_institution) THEN RAISE EXCEPTION 'Institution leadership required' USING ERRCODE='42501'; END IF;
 IF NOT private.noor_consume_limit('draft_workflow',30) THEN RAISE EXCEPTION 'Rate limit exceeded' USING ERRCODE='54000'; END IF;
 SELECT provider INTO v_provider FROM public.noor_connections WHERE id=p_connection AND institution_id=p_institution;
 IF v_provider IS NULL OR NOT ((p_operation='ai.generate' AND v_provider IN ('openai','gemini','anthropic'))
 OR (p_operation='github.read' AND v_provider='github') OR (p_operation='gmail.draft' AND v_provider='gmail')
 OR (p_operation='brevo.draft' AND v_provider='brevo') OR (p_operation='supabase.report' AND v_provider='supabase')) THEN
 RAISE EXCEPTION 'Unsupported connection operation' USING ERRCODE='22023'; END IF;
 INSERT INTO public.noor_workflow_jobs(institution_id,connection_id,requested_by,operation,payload,idempotency_key)
 VALUES(p_institution,p_connection,auth.uid(),p_operation,p_payload,p_idempotency_key)
 ON CONFLICT(institution_id,requested_by,idempotency_key) DO NOTHING RETURNING id INTO v_id;
 IF v_id IS NULL THEN
  SELECT * INTO v_existing FROM public.noor_workflow_jobs WHERE institution_id=p_institution AND requested_by=auth.uid() AND idempotency_key=p_idempotency_key;
  IF v_existing.connection_id IS DISTINCT FROM p_connection OR v_existing.operation IS DISTINCT FROM p_operation OR v_existing.payload IS DISTINCT FROM p_payload THEN
   RAISE EXCEPTION 'Idempotency key already used with different input' USING ERRCODE='22023'; END IF;
  RETURN v_existing.id;
 END IF;
 INSERT INTO public.noor_audit_events(institution_id,actor_id,action,entity_id) VALUES(p_institution,auth.uid(),'workflow.drafted',v_id);
 RETURN v_id;
END $$;
CREATE OR REPLACE FUNCTION public.noor_draft_workflow(p_institution uuid,p_connection uuid,p_operation text,p_payload jsonb,p_idempotency_key text)
RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path=''
AS $$ SELECT private.noor_draft_workflow(p_institution,p_connection,p_operation,p_payload,p_idempotency_key); $$;

CREATE OR REPLACE FUNCTION private.noor_set_member_status(p_institution uuid,p_membership uuid,p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$ DECLARE v_target public.institution_memberships;
BEGIN
 IF auth.uid() IS NULL OR NOT private.can_manage_academics(p_institution) THEN RAISE EXCEPTION 'Institution leadership required' USING ERRCODE='42501'; END IF;
 IF p_status NOT IN ('active','suspended') THEN RAISE EXCEPTION 'Status must be active or suspended' USING ERRCODE='22023'; END IF;
 SELECT * INTO v_target FROM public.institution_memberships WHERE id=p_membership AND institution_id=p_institution FOR UPDATE;
 IF NOT FOUND OR v_target.user_id=auth.uid() OR v_target.status NOT IN ('active','suspended') OR
 (v_target.role NOT IN ('teacher','faculty','staff','student','university_student') AND NOT private.is_platform_admin()) THEN
 RAISE EXCEPTION 'This membership cannot be changed by this account' USING ERRCODE='42501'; END IF;
 UPDATE public.institution_memberships SET status=p_status,updated_at=now() WHERE id=p_membership;
 INSERT INTO public.noor_audit_events(institution_id,actor_id,action,entity_id,metadata)
 VALUES(p_institution,auth.uid(),'membership.status_changed',p_membership,jsonb_build_object('status',p_status));
END $$;
CREATE OR REPLACE FUNCTION public.noor_set_member_status(p_institution uuid,p_membership uuid,p_status text)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.noor_set_member_status(p_institution,p_membership,p_status); $$;

-- Only authenticated callers may enter these tightly checked, non-exposed implementations.
REVOKE ALL ON FUNCTION private.noor_register_connection(uuid,text,text),private.noor_draft_workflow(uuid,uuid,text,jsonb,text),private.noor_set_member_status(uuid,uuid,text),
 public.noor_register_connection(uuid,text,text),public.noor_draft_workflow(uuid,uuid,text,jsonb,text),public.noor_set_member_status(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.noor_register_connection(uuid,text,text),private.noor_draft_workflow(uuid,uuid,text,jsonb,text),private.noor_set_member_status(uuid,uuid,text),
 public.noor_register_connection(uuid,text,text),public.noor_draft_workflow(uuid,uuid,text,jsonb,text),public.noor_set_member_status(uuid,uuid,text) TO authenticated;

-- Grades and submissions may never be uploaded to a public school asset bucket.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('noor-learning-files','noor-learning-files',false,52428800,ARRAY['application/pdf','image/jpeg','image/png','image/webp','video/mp4','audio/mpeg','text/plain']);
CREATE POLICY noor_learning_file_create ON storage.objects FOR INSERT TO authenticated WITH CHECK (
 bucket_id='noor-learning-files' AND (storage.foldername(name))[1]=(select auth.uid())::text
 AND EXISTS(SELECT 1 FROM public.institution_memberships m WHERE m.user_id=(select auth.uid()) AND m.status='active'
 AND m.role IN ('principal','school_admin','university_admin','academic_admin','teacher','faculty') AND private.is_active_member(m.institution_id)));
CREATE POLICY noor_learning_file_read ON storage.objects FOR SELECT TO authenticated USING (
 bucket_id='noor-learning-files' AND EXISTS(SELECT 1 FROM public.noor_learning_items l WHERE l.attachment_path=storage.objects.name));

CREATE OR REPLACE FUNCTION private.noor_audit_academic_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$ DECLARE v_row jsonb:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
BEGIN
 INSERT INTO public.noor_audit_events(institution_id,actor_id,action,entity_id)
 VALUES((v_row->>'institution_id')::uuid,auth.uid(),TG_TABLE_NAME||'.'||lower(TG_OP),(v_row->>'id')::uuid);
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
REVOKE ALL ON FUNCTION private.noor_audit_academic_change() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER noor_learning_audit AFTER INSERT OR UPDATE OR DELETE ON public.noor_learning_items FOR EACH ROW EXECUTE FUNCTION private.noor_audit_academic_change();
CREATE TRIGGER noor_submission_audit AFTER INSERT ON public.noor_assignment_submissions FOR EACH ROW EXECUTE FUNCTION private.noor_audit_academic_change();
CREATE TRIGGER noor_result_audit AFTER INSERT OR UPDATE ON public.noor_assessment_results FOR EACH ROW EXECUTE FUNCTION private.noor_audit_academic_change();
CREATE TRIGGER noor_calendar_audit AFTER INSERT OR UPDATE OR DELETE ON public.noor_calendar_events FOR EACH ROW EXECUTE FUNCTION private.noor_audit_academic_change();

CREATE TABLE private.noor_join_codes (
 institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
 role text NOT NULL CHECK(role IN ('teacher','student')),
 code_hash text NOT NULL UNIQUE,
 expires_at timestamptz NOT NULL,
 PRIMARY KEY(institution_id,role)
);
REVOKE ALL ON private.noor_join_codes FROM PUBLIC,anon,authenticated;
CREATE UNIQUE INDEX noor_membership_user_tenant ON public.institution_memberships(institution_id,user_id) WHERE user_id IS NOT NULL;
CREATE OR REPLACE FUNCTION private.noor_rotate_join_code(p_institution uuid,p_role text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$ DECLARE v_code text:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
BEGIN
 IF auth.uid() IS NULL OR NOT private.can_manage_academics(p_institution) THEN RAISE EXCEPTION 'Institution leadership required' USING ERRCODE='42501'; END IF;
 IF NOT private.noor_consume_limit('rotate_join_code',10) THEN RAISE EXCEPTION 'Rate limit exceeded' USING ERRCODE='54000'; END IF;
 INSERT INTO private.noor_join_codes(institution_id,role,code_hash,expires_at)
 VALUES(p_institution,p_role,encode(sha256(convert_to(v_code,'UTF8')),'hex'),now()+interval '30 days')
 ON CONFLICT(institution_id,role) DO UPDATE SET code_hash=EXCLUDED.code_hash,expires_at=EXCLUDED.expires_at;
 INSERT INTO public.noor_audit_events(institution_id,actor_id,action,metadata)
 VALUES(p_institution,auth.uid(),'joining_code.rotated',jsonb_build_object('role',p_role));
 RETURN v_code;
END $$;
CREATE OR REPLACE FUNCTION public.noor_rotate_join_code(p_institution uuid,p_role text)
RETURNS text LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.noor_rotate_join_code(p_institution,p_role); $$;

CREATE OR REPLACE FUNCTION private.noor_join_institution(p_institution uuid,p_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$ DECLARE v_role text; v_id uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE='42501'; END IF;
 IF NOT private.noor_consume_limit('join_institution',10) THEN RAISE EXCEPTION 'Rate limit exceeded' USING ERRCODE='54000'; END IF;
 SELECT c.role INTO v_role FROM private.noor_join_codes c JOIN public.institutions i ON i.id=c.institution_id
 WHERE c.institution_id=p_institution AND i.status='active' AND c.expires_at>now()
 AND c.code_hash=encode(sha256(convert_to(p_code,'UTF8')),'hex');
 IF v_role IS NULL THEN RAISE EXCEPTION 'Invalid or expired joining code' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM public.institution_memberships WHERE institution_id=p_institution AND user_id=auth.uid()) THEN
 RAISE EXCEPTION 'Membership already exists; ask leadership to manage your access' USING ERRCODE='22023'; END IF;
 INSERT INTO public.institution_memberships(institution_id,user_id,role,status,joined_at)
 VALUES(p_institution,auth.uid(),v_role,'active',now()) RETURNING id INTO v_id;
 INSERT INTO public.noor_audit_events(institution_id,actor_id,action,entity_id) VALUES(p_institution,auth.uid(),'membership.joined',v_id);
 RETURN v_id;
END $$;
CREATE OR REPLACE FUNCTION public.noor_join_institution(p_institution uuid,p_code text)
RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.noor_join_institution(p_institution,p_code); $$;
REVOKE ALL ON FUNCTION private.noor_rotate_join_code(uuid,text),public.noor_rotate_join_code(uuid,text),private.noor_join_institution(uuid,text),public.noor_join_institution(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.noor_rotate_join_code(uuid,text),public.noor_rotate_join_code(uuid,text),private.noor_join_institution(uuid,text),public.noor_join_institution(uuid,text) TO authenticated;

-- Atomic attendance batch. Caller JWT and existing RLS remain in force.
CREATE OR REPLACE FUNCTION public.noor_submit_attendance(p_session uuid,p_records jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $$ DECLARE v_session public.class_sessions; v_row jsonb; v_member uuid; v_count int:=0;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_records) IS DISTINCT FROM 'array' OR jsonb_array_length(p_records) NOT BETWEEN 1 AND 500 THEN
 RAISE EXCEPTION 'Submit between 1 and 500 attendance records' USING ERRCODE='22023'; END IF;
 SELECT * INTO v_session FROM public.class_sessions WHERE id=p_session;
 IF NOT FOUND OR NOT private.noor_group_access(v_session.institution_id,v_session.academic_group_id,true) THEN
 RAISE EXCEPTION 'Assigned teacher or institution leadership required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_session::text,0));
 IF (SELECT count(*) FROM jsonb_array_elements(p_records) r)<>(SELECT count(DISTINCT r->>'student_membership_id') FROM jsonb_array_elements(p_records) r) THEN
 RAISE EXCEPTION 'Duplicate student in attendance batch' USING ERRCODE='22023'; END IF;
 FOR v_row IN SELECT * FROM jsonb_array_elements(p_records) LOOP
  v_member:=(v_row->>'student_membership_id')::uuid;
  IF NOT private.noor_student_enrolled(v_session.institution_id,v_session.academic_group_id,v_member) THEN
   RAISE EXCEPTION 'Student is not actively enrolled in this class' USING ERRCODE='23514'; END IF;
  INSERT INTO public.attendance_records(institution_id,session_id,student_membership_id,attendance_status,marked_by,marked_at)
  VALUES(v_session.institution_id,p_session,v_member,v_row->>'status',auth.uid(),now())
  ON CONFLICT(session_id,student_membership_id) DO UPDATE SET attendance_status=EXCLUDED.attendance_status,marked_by=EXCLUDED.marked_by,marked_at=EXCLUDED.marked_at;
  v_count:=v_count+1;
 END LOOP;
 RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.noor_submit_attendance(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.noor_submit_attendance(uuid,jsonb) TO authenticated;
