-- NOOR AI Ticket 07: school identity, platform-admin allow-list, strict membership isolation.
-- Additive migration: preserves all existing tables and historical rows.

CREATE TABLE IF NOT EXISTS private.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  granted_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  reason text NOT NULL DEFAULT 'Explicit platform administration bootstrap',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.platform_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.platform_admins FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.is_platform_admin_user(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT EXISTS (SELECT 1 FROM private.platform_admins pa JOIN public.profiles p ON p.id=pa.user_id
    WHERE pa.user_id=p_user_id AND p.role='creator' AND p.status='active');
$function$;
REVOKE ALL ON FUNCTION private.is_platform_admin_user(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.is_creator()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$ SELECT private.is_platform_admin_user((SELECT auth.uid())) $function$;
REVOKE ALL ON FUNCTION private.is_creator() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_creator() TO authenticated;

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS official_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.schools
  ADD CONSTRAINT schools_verification_status_check CHECK (verification_status IN ('pending','verified','rejected')),
  ADD CONSTRAINT schools_account_status_check CHECK (account_status IN ('pending','active','suspended','closed')),
  ADD CONSTRAINT schools_official_email_check CHECK (official_email IS NULL OR (position('@' in official_email)>1 AND char_length(official_email)<=254)),
  ADD CONSTRAINT schools_address_length_check CHECK (address IS NULL OR char_length(address)<=500),
  ADD CONSTRAINT schools_contact_phone_length_check CHECK (contact_phone IS NULL OR char_length(contact_phone)<=30);

CREATE UNIQUE INDEX IF NOT EXISTS schools_official_email_ci_unique ON public.schools(lower(official_email))
  WHERE official_email IS NOT NULL AND btrim(official_email)<>'';
CREATE INDEX IF NOT EXISTS schools_verification_status_idx ON public.schools(verification_status,account_status);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS admission_number text,
  ADD COLUMN IF NOT EXISTS parent_phone text,
  ADD COLUMN IF NOT EXISTS academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE RESTRICT;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_admission_number_length_check CHECK (admission_number IS NULL OR char_length(admission_number) BETWEEN 1 AND 40),
  ADD CONSTRAINT profiles_parent_phone_length_check CHECK (parent_phone IS NULL OR char_length(parent_phone)<=30);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_student_admission_unique
 ON public.profiles(school_id,COALESCE(academic_year_id,'00000000-0000-0000-0000-000000000000'::uuid),lower(admission_number))
 WHERE role='student' AND school_id IS NOT NULL AND admission_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_student_roll_context_unique
 ON public.profiles(school_id,COALESCE(academic_year_id,'00000000-0000-0000-0000-000000000000'::uuid),class_id,COALESCE(section_id,'00000000-0000-0000-0000-000000000000'::uuid),lower(roll_number))
 WHERE role='student' AND school_id IS NOT NULL AND class_id IS NOT NULL AND roll_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS school_memberships_username_ci_unique ON public.school_memberships(school_id,lower(username))
 WHERE username IS NOT NULL AND btrim(username)<>'';
CREATE UNIQUE INDEX IF NOT EXISTS school_memberships_employee_id_ci_unique ON public.school_memberships(school_id,lower(employee_id))
 WHERE employee_id IS NOT NULL AND btrim(employee_id)<>'';

CREATE OR REPLACE FUNCTION private.current_actor_school()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
 SELECT p.school_id FROM public.profiles p JOIN public.school_memberships m
 ON m.school_id=p.school_id AND m.user_id=p.id AND m.status='active' AND m.role=p.role
 WHERE p.id=(SELECT auth.uid()) AND p.status='active' LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION private.has_school_role(target_school_id uuid,allowed_roles text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
 SELECT private.is_creator() OR EXISTS(
 SELECT 1 FROM public.profiles p JOIN public.school_memberships m
 ON m.school_id=p.school_id AND m.user_id=p.id AND m.status='active' AND m.role=p.role
 JOIN public.schools s ON s.id=p.school_id
 WHERE p.id=(SELECT auth.uid()) AND p.status='active' AND p.role=ANY(allowed_roles)
 AND p.school_id=target_school_id AND s.is_active AND s.verification_status='verified' AND s.account_status='active');
$function$;

CREATE OR REPLACE FUNCTION private.noor_active_school_access(p_school_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
 SELECT private.is_creator() OR EXISTS(
 SELECT 1 FROM public.profiles p JOIN public.school_memberships m
 ON m.school_id=p.school_id AND m.user_id=p.id AND m.status='active' AND m.role=p.role
 JOIN public.schools s ON s.id=p.school_id
 WHERE p.id=(SELECT auth.uid()) AND p.status='active' AND p.school_id=p_school_id
 AND s.is_active AND s.verification_status='verified' AND s.account_status='active');
$function$;

CREATE OR REPLACE FUNCTION private.noor_can_school_permission(p_school_id uuid,p_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
 SELECT private.is_creator() OR EXISTS(
 SELECT 1 FROM public.profiles p JOIN public.school_memberships m
 ON m.school_id=p.school_id AND m.user_id=p.id AND m.status='active' AND m.role=p.role
 JOIN public.schools s ON s.id=p.school_id
 WHERE p.id=(SELECT auth.uid()) AND p.status='active' AND p.school_id=p_school_id
 AND s.is_active AND s.verification_status='verified' AND s.account_status='active'
 AND (p.role IN ('owner','principal') OR (p.role='manager' AND EXISTS(
 SELECT 1 FROM public.role_permissions rp WHERE rp.school_id=p_school_id AND rp.role='manager'
 AND rp.permission_key=p_permission AND rp.is_allowed))));
$function$;

CREATE OR REPLACE FUNCTION private.can_manage_class_context(p_school_id uuid,p_class_id uuid,p_section_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
 SELECT private.is_creator() OR EXISTS(
 SELECT 1 FROM public.profiles actor JOIN public.school_memberships m
 ON m.school_id=actor.school_id AND m.user_id=actor.id AND m.status='active' AND m.role=actor.role
 JOIN public.schools s ON s.id=actor.school_id
 WHERE actor.id=(SELECT auth.uid()) AND actor.status='active' AND actor.school_id=p_school_id
 AND s.is_active AND s.verification_status='verified' AND s.account_status='active'
 AND (actor.role IN ('owner','principal') OR (actor.role='teacher' AND EXISTS(
 SELECT 1 FROM public.teacher_assignments ta WHERE ta.school_id=p_school_id AND ta.teacher_id=actor.id
 AND ta.class_id=p_class_id AND ta.is_active AND (ta.section_id IS NULL OR ta.section_id IS NOT DISTINCT FROM p_section_id)))));
$function$;

CREATE OR REPLACE FUNCTION private.noor_is_assigned_teacher(p_school_id uuid,p_class_id uuid,p_section_id uuid,p_subject_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
 SELECT EXISTS(SELECT 1 FROM public.profiles p JOIN public.school_memberships m
 ON m.school_id=p.school_id AND m.user_id=p.id AND m.role='teacher' AND m.status='active'
 JOIN public.schools s ON s.id=p.school_id
 WHERE p.id=(SELECT auth.uid()) AND p.status='active' AND p.role='teacher' AND p.school_id=p_school_id
 AND s.is_active AND s.verification_status='verified' AND s.account_status='active'
 AND EXISTS(SELECT 1 FROM public.teacher_assignments ta WHERE ta.school_id=p_school_id AND ta.teacher_id=p.id
 AND ta.class_id=p_class_id AND ta.is_active AND (ta.section_id IS NULL OR ta.section_id IS NOT DISTINCT FROM p_section_id)
 AND (ta.subject_id IS NULL OR ta.subject_id=p_subject_id)));
$function$;

CREATE OR REPLACE FUNCTION private.can_manage_profile(target_profile_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
 SELECT private.is_creator() OR EXISTS(
 SELECT 1 FROM public.profiles target JOIN public.profiles actor ON actor.id=(SELECT auth.uid())
 JOIN public.school_memberships m ON m.school_id=actor.school_id AND m.user_id=actor.id AND m.status='active' AND m.role=actor.role
 JOIN public.schools s ON s.id=actor.school_id
 WHERE target.id=target_profile_id AND actor.status='active' AND actor.school_id=target.school_id AND actor.school_id IS NOT NULL
 AND s.is_active AND s.verification_status='verified' AND s.account_status='active'
 AND (actor.role IN ('owner','principal')
 OR (actor.role='manager' AND EXISTS(SELECT 1 FROM public.role_permissions rp WHERE rp.school_id=actor.school_id
 AND rp.role='manager' AND rp.permission_key=CASE WHEN target.role='student' THEN 'view_students' ELSE 'manage_staff' END AND rp.is_allowed))
 OR (actor.role='teacher' AND target.role='student' AND private.noor_is_assigned_teacher(actor.school_id,target.class_id,target.section_id,
 (SELECT ta.subject_id FROM public.teacher_assignments ta WHERE ta.teacher_id=actor.id AND ta.class_id=target.class_id AND ta.is_active LIMIT 1)))));
$function$;

CREATE OR REPLACE FUNCTION private.noor_guard_school_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
  RAISE EXCEPTION 'School ID and original creator are immutable' USING errcode='42501';
 END IF;
 IF (NEW.verification_status IS DISTINCT FROM OLD.verification_status OR NEW.account_status IS DISTINCT FROM OLD.account_status
 OR NEW.verified_at IS DISTINCT FROM OLD.verified_at OR NEW.verified_by IS DISTINCT FROM OLD.verified_by
 OR NEW.is_active IS DISTINCT FROM OLD.is_active) AND NOT private.is_creator() THEN
  RAISE EXCEPTION 'Only authorised platform administration can verify or suspend a school' USING errcode='42501';
 END IF;
 IF (NEW.join_code IS DISTINCT FROM OLD.join_code OR NEW.secret_code_hash IS DISTINCT FROM OLD.secret_code_hash
 OR NEW.secret_code_rotated_at IS DISTINCT FROM OLD.secret_code_rotated_at OR NEW.master_key_hash IS DISTINCT FROM OLD.master_key_hash)
 AND NOT private.is_creator() AND current_setting('noor.allow_school_secret_change',true) IS DISTINCT FROM 'on' THEN
  RAISE EXCEPTION 'School codes and privileged recovery credentials must be changed through the secure rotation flow' USING errcode='42501';
 END IF;
 RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS noor_guard_school_identity ON public.schools;
CREATE TRIGGER noor_guard_school_identity BEFORE UPDATE ON public.schools FOR EACH ROW EXECUTE FUNCTION private.noor_guard_school_identity();

CREATE OR REPLACE FUNCTION public.sync_school_directory()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
 INSERT INTO public.school_directory(id,name,logo_url,is_active,updated_at)
 VALUES(NEW.id,NEW.name,NEW.logo_url,NEW.is_active AND NEW.verification_status='verified' AND NEW.account_status='active',now())
 ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,logo_url=EXCLUDED.logo_url,is_active=EXCLUDED.is_active,updated_at=now();
 RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS schools_sync_directory ON public.schools;
CREATE TRIGGER schools_sync_directory AFTER INSERT OR UPDATE OF name,logo_url,is_active,verification_status,account_status ON public.schools
FOR EACH ROW EXECUTE FUNCTION public.sync_school_directory();

CREATE OR REPLACE FUNCTION private.noor_validate_profile_school_context()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
 IF NEW.school_id IS NULL THEN
  IF NEW.class_id IS NOT NULL OR NEW.section_id IS NOT NULL OR NEW.academic_year_id IS NOT NULL THEN
   RAISE EXCEPTION 'Class, section and academic year require a school membership' USING errcode='23514';
  END IF;
  RETURN NEW;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.schools s WHERE s.id=NEW.school_id) THEN RAISE EXCEPTION 'Unknown school ID' USING errcode='23503'; END IF;
 IF NEW.class_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.classes c WHERE c.id=NEW.class_id AND c.school_id=NEW.school_id) THEN
  RAISE EXCEPTION 'Class does not belong to the selected school' USING errcode='23514';
 END IF;
 IF NEW.section_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.sections sec WHERE sec.id=NEW.section_id AND sec.class_id=NEW.class_id) THEN
  RAISE EXCEPTION 'Section does not belong to the selected class' USING errcode='23514';
 END IF;
 IF NEW.academic_year_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.academic_years ay WHERE ay.id=NEW.academic_year_id AND ay.school_id=NEW.school_id) THEN
  RAISE EXCEPTION 'Academic year does not belong to the selected school' USING errcode='23514';
 END IF;
 RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS noor_validate_profile_school_context ON public.profiles;
CREATE TRIGGER noor_validate_profile_school_context BEFORE INSERT OR UPDATE OF school_id,class_id,section_id,academic_year_id
ON public.profiles FOR EACH ROW EXECUTE FUNCTION private.noor_validate_profile_school_context();

CREATE OR REPLACE FUNCTION private.noor_guard_school_membership()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'School memberships are historical records; mark them removed instead of deleting' USING errcode='42501'; END IF;
 IF TG_OP='INSERT' THEN
  IF auth.uid() IS NULL OR current_setting('noor.accepting_invitation',true)='on' THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Memberships must be created by the trusted invitation or provisioning flow' USING errcode='42501';
 END IF;
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.school_id IS DISTINCT FROM OLD.school_id OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
  RAISE EXCEPTION 'Membership identity is immutable' USING errcode='42501';
 END IF;
 IF NEW.role IS DISTINCT FROM OLD.role AND current_setting('noor.accepting_invitation',true) IS DISTINCT FROM 'on' AND NOT private.is_creator() THEN
  RAISE EXCEPTION 'Membership roles can only be assigned by a trusted invitation or platform administration' USING errcode='42501';
 END IF;
 IF NEW.status IS DISTINCT FROM OLD.status AND current_setting('noor.accepting_invitation',true) IS DISTINCT FROM 'on'
 AND auth.uid() IS NOT NULL AND NOT private.is_creator() AND NOT private.noor_can_school_permission(OLD.school_id,'manage_staff') THEN
  RAISE EXCEPTION 'You are not authorised to change this membership status' USING errcode='42501';
 END IF;
 NEW.updated_at:=now(); RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS noor_guard_school_membership ON public.school_memberships;
CREATE TRIGGER noor_guard_school_membership BEFORE INSERT OR UPDATE OR DELETE ON public.school_memberships
FOR EACH ROW EXECUTE FUNCTION private.noor_guard_school_membership();

CREATE OR REPLACE FUNCTION private.noor_guard_invitation_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_actor_role text;
BEGIN
 IF TG_OP='UPDATE' AND current_setting('noor.accepting_invitation',true)='on' THEN RETURN NEW; END IF;
 SELECT role INTO v_actor_role FROM public.profiles WHERE id=(SELECT auth.uid()) AND status='active';
 IF TG_OP='INSERT' THEN
  IF NEW.created_by IS DISTINCT FROM (SELECT auth.uid()) THEN RAISE EXCEPTION 'Invitation creator must be the signed-in user' USING errcode='42501'; END IF;
  IF NEW.role='owner' AND NOT private.is_creator() THEN RAISE EXCEPTION 'Only platform administration can issue the first owner invitation' USING errcode='42501'; END IF;
  IF NEW.role IN ('principal','manager') AND NOT (private.is_creator() OR EXISTS(
   SELECT 1 FROM public.school_memberships m WHERE m.school_id=NEW.school_id AND m.user_id=(SELECT auth.uid()) AND m.role='owner' AND m.status='active'
  )) THEN RAISE EXCEPTION 'Only platform administration or the active school owner can appoint a Principal/Manager' USING errcode='42501'; END IF;
 ELSE
  IF NEW.school_id IS DISTINCT FROM OLD.school_id OR NEW.role IS DISTINCT FROM OLD.role OR NEW.invited_email IS DISTINCT FROM OLD.invited_email
   OR NEW.invited_name IS DISTINCT FROM OLD.invited_name OR NEW.token_hash IS DISTINCT FROM OLD.token_hash OR NEW.created_by IS DISTINCT FROM OLD.created_by
   OR NEW.expires_at IS DISTINCT FROM OLD.expires_at OR NEW.max_uses IS DISTINCT FROM OLD.max_uses OR NEW.used_count IS DISTINCT FROM OLD.used_count THEN
   RAISE EXCEPTION 'Invitation identity is immutable; use the trusted accept or revoke flow' USING errcode='42501';
  END IF;
  IF NOT (private.has_school_role(NEW.school_id,ARRAY['owner']) OR (OLD.created_by=(SELECT auth.uid()) AND private.noor_can_school_permission(NEW.school_id,'manage_invites'))) THEN
   RAISE EXCEPTION 'You cannot edit this invitation' USING errcode='42501';
  END IF;
 END IF;
 RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION private.noor_accept_school_invitation(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_user uuid; v_email text; v_verified timestamptz; v_name text; v_username text; v_mobile text; v_inv public.school_invitations%rowtype;
BEGIN
 v_user:=auth.uid();
 IF v_user IS NULL OR length(coalesce(p_token,''))<24 OR length(p_token)>256 THEN RAISE EXCEPTION 'Valid sign-in and invitation token are required' USING errcode='42501'; END IF;
 SELECT email,email_confirmed_at,coalesce(raw_user_meta_data->>'full_name','School member'),
 nullif(trim(coalesce(raw_user_meta_data->>'username','')),''),nullif(trim(coalesce(raw_user_meta_data->>'mobile_number','')),'')
 INTO v_email,v_verified,v_name,v_username,v_mobile FROM auth.users WHERE id=v_user;
 IF v_verified IS NULL OR v_email IS NULL THEN RAISE EXCEPTION 'Verify your email before accepting this invitation' USING errcode='42501'; END IF;
 SELECT * INTO v_inv FROM public.school_invitations WHERE token_hash=encode(digest(p_token,'sha256'),'hex') FOR UPDATE;
 IF NOT FOUND OR v_inv.revoked_at IS NOT NULL OR v_inv.expires_at<=now() OR v_inv.used_count>=v_inv.max_uses THEN
  RAISE EXCEPTION 'Invitation is invalid, expired, revoked or already used' USING errcode='42501';
 END IF;
 IF v_inv.invited_email IS NOT NULL AND lower(v_inv.invited_email)<>lower(v_email) THEN RAISE EXCEPTION 'This invitation belongs to a different email address' USING errcode='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.schools s WHERE s.id=v_inv.school_id AND s.is_active AND s.verification_status='verified' AND s.account_status='active') THEN
  RAISE EXCEPTION 'This school is not yet approved for account onboarding' USING errcode='42501';
 END IF;
 IF v_inv.role='owner' THEN
  IF NOT private.is_platform_admin_user(v_inv.created_by) OR EXISTS(SELECT 1 FROM public.school_memberships m WHERE m.school_id=v_inv.school_id AND m.role='owner' AND m.status='active') THEN
   RAISE EXCEPTION 'The first owner must be invited by authorised platform administration and no active owner may already exist' USING errcode='42501';
  END IF;
 ELSIF v_inv.role IN ('principal','manager') AND NOT (private.is_platform_admin_user(v_inv.created_by) OR EXISTS(
  SELECT 1 FROM public.school_memberships m WHERE m.school_id=v_inv.school_id AND m.user_id=v_inv.created_by AND m.role='owner' AND m.status='active'
 )) THEN
  RAISE EXCEPTION 'Only authorised platform administration or the active School Owner can appoint a Principal/Manager' USING errcode='42501';
 END IF;
 IF EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=v_user AND p.status='inactive') THEN RAISE EXCEPTION 'This account is suspended; contact an authorised administrator' USING errcode='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=v_user AND p.school_id IS NOT NULL AND p.school_id<>v_inv.school_id) THEN
  RAISE EXCEPTION 'This account already belongs to another primary school. Multi-school profile switching is not configured.' USING errcode='42501';
 END IF;
 IF v_inv.role='owner' AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=v_user AND p.role='creator') THEN RAISE EXCEPTION 'Platform administration accounts cannot be converted into school-owner accounts' USING errcode='42501'; END IF;
 IF v_username IS NOT NULL AND (length(v_username)<3 OR length(v_username)>40 OR v_username !~ '^[A-Za-z0-9._-]+$') THEN
  RAISE EXCEPTION 'Choose a valid username: 3–40 letters, numbers, dot, underscore or dash' USING errcode='22023';
 END IF;
 IF v_username IS NULL THEN
  v_username:=lower(regexp_replace(split_part(v_email,'@',1),'[^a-z0-9._-]','','g')); v_username:=left(v_username,26);
  IF length(v_username)<3 THEN v_username:='member'; END IF; v_username:=v_username||'-'||lower(substr(encode(gen_random_bytes(3),'hex'),1,6));
 END IF;
 IF EXISTS(SELECT 1 FROM public.school_memberships m WHERE m.school_id=v_inv.school_id AND lower(m.username)=lower(v_username) AND m.user_id<>v_user) THEN
  RAISE EXCEPTION 'This username is already taken in this school. Use a different username and retry the invitation.' USING errcode='23505';
 END IF;
 v_name:=left(coalesce(nullif(trim(v_name),''),'School member'),120);
 PERFORM set_config('noor.accepting_invitation','on',true);
 UPDATE public.school_invitations SET used_count=used_count+1 WHERE id=v_inv.id;
 PERFORM set_config('noor.allow_profile_admin_change','on',true);
 INSERT INTO public.profiles(id,email,full_name,role,status,school_id,school_name_submitted,mobile_number,updated_at)
 VALUES(v_user,v_email,v_name,v_inv.role,'active',v_inv.school_id,(SELECT name FROM public.schools WHERE id=v_inv.school_id),v_mobile,now())
 ON CONFLICT(id) DO UPDATE SET email=excluded.email,full_name=coalesce(nullif(public.profiles.full_name,''),excluded.full_name),
 role=excluded.role,status='active',school_id=excluded.school_id,school_name_submitted=excluded.school_name_submitted,
 mobile_number=coalesce(excluded.mobile_number,public.profiles.mobile_number),updated_at=now();
 INSERT INTO public.school_memberships(school_id,user_id,role,status,username,joined_at)
 VALUES(v_inv.school_id,v_user,v_inv.role,'active',v_username,now())
 ON CONFLICT(school_id,user_id) DO UPDATE SET role=excluded.role,status='active',username=excluded.username,removed_at=NULL,
 removed_by=NULL,removal_reason=NULL,joined_at=now(),updated_at=now();
 IF v_inv.role='owner' THEN UPDATE public.schools SET owner_user_id=v_user WHERE id=v_inv.school_id; END IF;
 INSERT INTO public.administrative_audit_logs(school_id,actor_id,target_user_id,action,metadata)
 VALUES(v_inv.school_id,v_user,v_user,'school_invitation_accepted',jsonb_build_object('invitation_id',v_inv.id,'role',v_inv.role,'username',v_username));
 RETURN jsonb_build_object('school_id',v_inv.school_id,'role',v_inv.role,'school_name',(SELECT name FROM public.schools WHERE id=v_inv.school_id),'username',v_username);
END;
$function$;

CREATE OR REPLACE FUNCTION private.noor_rotate_school_secret_code(p_school_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_code text; v_actor uuid;
BEGIN
 v_actor:=auth.uid(); IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication required' USING errcode='42501'; END IF;
 IF NOT (private.is_creator() OR EXISTS(SELECT 1 FROM public.school_memberships m WHERE m.school_id=p_school_id AND m.user_id=v_actor AND m.role='owner' AND m.status='active')) THEN
  RAISE EXCEPTION 'Only the school owner may rotate the School Secret Code' USING errcode='42501';
 END IF;
 v_code:='NOOR-'||upper(encode(gen_random_bytes(16),'hex'));
 PERFORM set_config('noor.allow_school_secret_change','on',true);
 UPDATE public.schools SET secret_code_hash=encode(digest(v_code,'sha256'),'hex'),secret_code_rotated_at=now(),updated_at=now() WHERE id=p_school_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'School not found' USING errcode='P0002'; END IF;
 INSERT INTO public.administrative_audit_logs(school_id,actor_id,action,metadata) VALUES(p_school_id,v_actor,'school_secret_code_rotated',jsonb_build_object('rotated_at',now()));
 RETURN v_code;
END;
$function$;

CREATE OR REPLACE FUNCTION public.noor_is_platform_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$ SELECT private.is_creator() $function$;
REVOKE ALL ON FUNCTION public.noor_is_platform_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.noor_is_platform_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.noor_create_owner_invitation(p_school_id uuid,p_invited_email text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_token text;
BEGIN
 IF auth.uid() IS NULL OR NOT private.is_creator() THEN RAISE EXCEPTION 'Only authorised platform administration can invite the first School Owner' USING errcode='42501'; END IF;
 IF p_invited_email IS NULL OR position('@' in p_invited_email)<=1 OR length(p_invited_email)>254 THEN RAISE EXCEPTION 'A valid owner email address is required' USING errcode='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.schools s WHERE s.id=p_school_id AND s.verification_status='verified' AND s.account_status='active' AND s.is_active) THEN
  RAISE EXCEPTION 'Verify and activate the school before issuing the owner invitation' USING errcode='42501';
 END IF;
 IF EXISTS(SELECT 1 FROM public.school_memberships m WHERE m.school_id=p_school_id AND m.role='owner' AND m.status='active') THEN
  RAISE EXCEPTION 'This school already has an active owner' USING errcode='23505';
 END IF;
 v_token:=encode(gen_random_bytes(32),'hex');
 INSERT INTO public.school_invitations(school_id,role,invited_email,token_hash,created_by,expires_at,max_uses)
 VALUES(p_school_id,'owner',lower(trim(p_invited_email)),encode(digest(v_token,'sha256'),'hex'),auth.uid(),now()+interval '7 days',1);
 INSERT INTO public.administrative_audit_logs(school_id,actor_id,action,metadata) VALUES(p_school_id,auth.uid(),'school_owner_invitation_created',jsonb_build_object('invited_email',lower(trim(p_invited_email))));
 RETURN v_token;
END;
$function$;
REVOKE ALL ON FUNCTION public.noor_create_owner_invitation(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.noor_create_owner_invitation(uuid,text) TO authenticated;

REVOKE ALL ON FUNCTION public.noor_accept_school_invitation(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.noor_accept_school_invitation(text) TO authenticated;

REVOKE ALL ON FUNCTION private.has_school_role(uuid,text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.noor_active_school_access(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.noor_can_school_permission(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.can_manage_class_context(uuid,uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.noor_is_assigned_teacher(uuid,uuid,uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.can_manage_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_school_role(uuid,text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION private.noor_active_school_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.noor_can_school_permission(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_manage_class_context(uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.noor_is_assigned_teacher(uuid,uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_manage_profile(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.noor_audit_school_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
 IF NEW.verification_status IS DISTINCT FROM OLD.verification_status OR NEW.account_status IS DISTINCT FROM OLD.account_status OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN
  INSERT INTO public.administrative_audit_logs(school_id,actor_id,action,metadata)
  VALUES(NEW.id,(SELECT auth.uid()),'school_status_changed',jsonb_build_object('verification_status',NEW.verification_status,'account_status',NEW.account_status,'is_active',NEW.is_active));
 END IF;
 RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS noor_audit_school_status_change ON public.schools;
CREATE TRIGGER noor_audit_school_status_change AFTER UPDATE ON public.schools FOR EACH ROW EXECUTE FUNCTION private.noor_audit_school_status_change();
UPDATE public.school_directory d SET is_active=(s.is_active AND s.verification_status='verified' AND s.account_status='active') FROM public.schools s WHERE s.id=d.id;
