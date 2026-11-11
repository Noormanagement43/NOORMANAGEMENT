-- Principal operations requested for working dashboard buttons.
CREATE TABLE public.noor_staff_checkins(
 institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,membership_id uuid NOT NULL,checkin_date date NOT NULL,
 status text NOT NULL CHECK(status IN ('present','late','absent','leave')),marked_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),marked_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(membership_id,checkin_date),FOREIGN KEY(membership_id,institution_id) REFERENCES public.institution_memberships(id,institution_id) ON DELETE CASCADE);
CREATE INDEX staff_checkins_tenant_date ON public.noor_staff_checkins(institution_id,checkin_date);
ALTER TABLE public.noor_staff_checkins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.noor_staff_checkins FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE ON public.noor_staff_checkins TO authenticated;
CREATE POLICY staff_checkins_read ON public.noor_staff_checkins FOR SELECT TO authenticated USING(private.can_manage_academics(institution_id) OR private.is_my_membership(membership_id));
CREATE POLICY staff_checkins_insert ON public.noor_staff_checkins FOR INSERT TO authenticated WITH CHECK(private.can_manage_academics(institution_id) AND marked_by=auth.uid());
CREATE POLICY staff_checkins_update ON public.noor_staff_checkins FOR UPDATE TO authenticated USING(private.can_manage_academics(institution_id)) WITH CHECK(private.can_manage_academics(institution_id) AND marked_by=auth.uid());
CREATE TABLE public.noor_principal_tasks(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
 title text NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 180),body text NOT NULL DEFAULT '' CHECK(length(body)<=10000),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','completed','archived')),due_at timestamptz,created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX principal_tasks_tenant ON public.noor_principal_tasks(institution_id);
ALTER TABLE public.noor_principal_tasks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.noor_principal_tasks FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE ON public.noor_principal_tasks TO authenticated;
CREATE POLICY principal_tasks_read ON public.noor_principal_tasks FOR SELECT TO authenticated USING(private.can_manage_academics(institution_id));
CREATE POLICY principal_tasks_insert ON public.noor_principal_tasks FOR INSERT TO authenticated WITH CHECK(private.can_manage_academics(institution_id) AND created_by=auth.uid());
CREATE POLICY principal_tasks_update ON public.noor_principal_tasks FOR UPDATE TO authenticated USING(private.can_manage_academics(institution_id)) WITH CHECK(private.can_manage_academics(institution_id));
-- Existing noor_set_member_status(p_institution,p_membership,p_status) is reused unchanged.
