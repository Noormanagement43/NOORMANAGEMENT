-- Source for the applied owner onboarding/RPC hardening migration.
CREATE INDEX IF NOT EXISTS platform_admins_granted_by_idx ON private.platform_admins(granted_by);
CREATE INDEX IF NOT EXISTS profiles_academic_year_id_idx ON public.profiles(academic_year_id);
CREATE INDEX IF NOT EXISTS schools_owner_user_id_idx ON public.schools(owner_user_id);
CREATE INDEX IF NOT EXISTS schools_verified_by_idx ON public.schools(verified_by);
CREATE INDEX IF NOT EXISTS syllabus_uploads_academic_year_id_idx ON public.syllabus_uploads(academic_year_id);
CREATE INDEX IF NOT EXISTS syllabus_uploads_class_id_idx ON public.syllabus_uploads(class_id);
CREATE INDEX IF NOT EXISTS syllabus_uploads_section_id_idx ON public.syllabus_uploads(section_id);
CREATE INDEX IF NOT EXISTS syllabus_uploads_subject_id_idx ON public.syllabus_uploads(subject_id);
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS official_email_verified_at timestamptz;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_creator() TO authenticated;
CREATE OR REPLACE FUNCTION public.noor_is_platform_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO ''
AS $function$ SELECT private.is_creator() $function$;
REVOKE ALL ON FUNCTION public.noor_is_platform_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.noor_is_platform_admin() TO authenticated;

-- The private six-argument owner creation function stores school details but creates a pending school.
-- The legacy three-argument wrapper is retained for compatibility.
CREATE OR REPLACE FUNCTION private.noor_create_school_owner(p_school_name text,p_username text,p_mobile text,p_address text,p_official_email text,p_contact_phone text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_user uuid; v_email text; v_verified timestamptz; v_full_name text; v_school_id uuid; v_join text; v_secret text;
BEGIN
 v_user:=auth.uid(); IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in to continue' USING errcode='42501'; END IF;
 IF length(trim(coalesce(p_school_name,'')))<2 OR length(trim(p_school_name))>180 THEN RAISE EXCEPTION 'Enter a valid official school name' USING errcode='22023'; END IF;
 IF length(trim(coalesce(p_username,'')))<3 OR length(trim(p_username))>40 OR p_username !~ '^[A-Za-z0-9._-]+$' THEN RAISE EXCEPTION 'Choose a valid username (3–40 letters, numbers, dot, underscore or dash)' USING errcode='22023'; END IF;
 IF p_address IS NOT NULL AND length(p_address)>500 THEN RAISE EXCEPTION 'School address is too long' USING errcode='22023'; END IF;
 IF p_official_email IS NOT NULL AND (position('@' in p_official_email)<=1 OR length(p_official_email)>254) THEN RAISE EXCEPTION 'Enter a valid official school email' USING errcode='22023'; END IF;
 IF p_contact_phone IS NOT NULL AND length(p_contact_phone)>30 THEN RAISE EXCEPTION 'School contact number is too long' USING errcode='22023'; END IF;
 SELECT email,email_confirmed_at,coalesce(raw_user_meta_data->>'full_name','School Owner') INTO v_email,v_verified,v_full_name FROM auth.users WHERE id=v_user;
 IF v_verified IS NULL OR v_email IS NULL THEN RAISE EXCEPTION 'Verify your account email before creating a school' USING errcode='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.profiles WHERE id=v_user AND role IN ('creator','owner')) THEN RAISE EXCEPTION 'This account already has a platform or school-owner role' USING errcode='23505'; END IF;
 IF EXISTS(SELECT 1 FROM public.profiles WHERE id=v_user AND school_id IS NOT NULL) THEN RAISE EXCEPTION 'This account is already linked to a school' USING errcode='23505'; END IF;
 IF EXISTS(SELECT 1 FROM public.school_memberships WHERE lower(username)=lower(trim(p_username))) THEN RAISE EXCEPTION 'That username is already used by a school member' USING errcode='23505'; END IF;
 v_join:='N'||upper(encode(gen_random_bytes(12),'hex')); v_secret:='NOOR-'||upper(encode(gen_random_bytes(16),'hex'));
 INSERT INTO public.schools(name,address,official_email,contact_phone,verification_status,account_status,join_code,secret_code_hash,secret_code_rotated_at,is_active,created_by,owner_user_id)
 VALUES(trim(p_school_name),nullif(trim(coalesce(p_address,'')),''),nullif(lower(trim(coalesce(p_official_email,''))),''),
 nullif(trim(coalesce(p_contact_phone,'')),''),'pending','pending',v_join,encode(digest(v_secret,'sha256'),'hex'),now(),true,v_user,v_user) RETURNING id INTO v_school_id;
 PERFORM set_config('noor.allow_profile_admin_change','on',true); PERFORM set_config('noor.accepting_invitation','on',true);
 INSERT INTO public.profiles(id,email,full_name,role,status,school_id,school_name_submitted,mobile_number,updated_at)
 VALUES(v_user,v_email,coalesce(nullif(trim(v_full_name),''),'School Owner'),'owner','active',v_school_id,trim(p_school_name),nullif(trim(coalesce(p_mobile,'')),''),now())
 ON CONFLICT(id) DO UPDATE SET email=excluded.email,role='owner',status='active',school_id=v_school_id,school_name_submitted=trim(p_school_name),mobile_number=coalesce(excluded.mobile_number,public.profiles.mobile_number),updated_at=now();
 INSERT INTO public.school_memberships(school_id,user_id,role,status,username,joined_at) VALUES(v_school_id,v_user,'owner','active',trim(p_username),now());
 INSERT INTO public.school_settings(school_id,academic_year_label,timezone,updated_by,updated_at) VALUES(v_school_id,NULL,'Asia/Kolkata',v_user,now()) ON CONFLICT(school_id) DO NOTHING;
 INSERT INTO public.administrative_audit_logs(school_id,actor_id,target_user_id,action,metadata)
 VALUES(v_school_id,v_user,v_user,'school_created_pending_verification',jsonb_build_object('school_name',trim(p_school_name),'official_email_provided',p_official_email IS NOT NULL));
 RETURN jsonb_build_object('school_id',v_school_id,'school_name',trim(p_school_name),'verification_status','pending','account_status','pending','join_code',v_join,'secret_code',v_secret);
END;
$function$;
REVOKE ALL ON FUNCTION private.noor_create_school_owner(text,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.noor_create_school_owner(text,text,text,text,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION private.noor_create_school_owner(p_school_name text,p_username text,p_mobile text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $function$ SELECT private.noor_create_school_owner(p_school_name,p_username,p_mobile,NULL,NULL,NULL) $function$;
REVOKE ALL ON FUNCTION private.noor_create_school_owner(text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.noor_create_school_owner(text,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.noor_create_school_owner(p_school_name text,p_username text,p_mobile text DEFAULT NULL,p_address text DEFAULT NULL,p_official_email text DEFAULT NULL,p_contact_phone text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $function$ SELECT private.noor_create_school_owner(p_school_name,p_username,p_mobile,p_address,p_official_email,p_contact_phone) $function$;
REVOKE ALL ON FUNCTION public.noor_create_school_owner(text,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.noor_create_school_owner(text,text,text,text,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.noor_create_school_owner(p_school_name text,p_username text,p_mobile text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $function$ SELECT private.noor_create_school_owner(p_school_name,p_username,p_mobile) $function$;
REVOKE ALL ON FUNCTION public.noor_create_school_owner(text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.noor_create_school_owner(text,text,text) TO authenticated;
DROP FUNCTION IF EXISTS public.noor_create_owner_invitation(uuid,text);
