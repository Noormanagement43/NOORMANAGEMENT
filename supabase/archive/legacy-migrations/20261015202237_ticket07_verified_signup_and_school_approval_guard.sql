-- Require verified email plus approved school and valid class/section before activating student membership.
CREATE OR REPLACE FUNCTION public.handle_noor_auth_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
 v_school_id uuid; v_requested_school_id uuid; v_class_id uuid; v_requested_class_id uuid;
 v_section_id uuid; v_requested_section_id uuid; v_join_code text; v_code_valid boolean:=false;
 v_class_name text; v_section_name text; v_status text;
BEGIN
 BEGIN v_requested_school_id:=nullif(NEW.raw_user_meta_data->>'school_id','')::uuid; EXCEPTION WHEN others THEN v_requested_school_id:=NULL; END;
 BEGIN v_requested_class_id:=nullif(NEW.raw_user_meta_data->>'class_id','')::uuid; EXCEPTION WHEN others THEN v_requested_class_id:=NULL; END;
 BEGIN v_requested_section_id:=nullif(NEW.raw_user_meta_data->>'section_id','')::uuid; EXCEPTION WHEN others THEN v_requested_section_id:=NULL; END;
 v_join_code:=trim(coalesce(NEW.raw_user_meta_data->>'school_join_code',''));
 SELECT s.id INTO v_school_id FROM public.schools s WHERE s.id=v_requested_school_id AND s.is_active LIMIT 1;
 IF v_school_id IS NOT NULL THEN
  SELECT EXISTS(SELECT 1 FROM public.schools s WHERE s.id=v_school_id AND s.is_active AND s.verification_status='verified' AND s.account_status='active'
    AND (s.join_code=v_join_code OR (s.secret_code_hash IS NOT NULL AND s.secret_code_hash=encode(digest(v_join_code,'sha256'),'hex')))) INTO v_code_valid;
  SELECT c.id,c.name INTO v_class_id,v_class_name FROM public.classes c WHERE c.id=v_requested_class_id AND c.school_id=v_school_id AND c.is_active LIMIT 1;
  IF v_class_id IS NOT NULL THEN SELECT sec.id,sec.name INTO v_section_id,v_section_name FROM public.sections sec WHERE sec.id=v_requested_section_id AND sec.class_id=v_class_id AND sec.is_active LIMIT 1; END IF;
 END IF;
 v_status:=CASE WHEN v_code_valid AND v_class_id IS NOT NULL AND v_section_id IS NOT NULL AND NEW.email_confirmed_at IS NOT NULL THEN 'active' ELSE 'pending' END;
 INSERT INTO public.profiles(id,email,full_name,role,status,school_id,school_name_submitted,mobile_number,parent_name,roll_number,class_id,section_id,requested_class_name,requested_section_name)
 VALUES(NEW.id,coalesce(NEW.email,''),left(trim(coalesce(NEW.raw_user_meta_data->>'full_name','')),120),'student',v_status,v_school_id,
 left(trim(coalesce(NEW.raw_user_meta_data->>'school_name_submitted','')),180),left(trim(coalesce(NEW.raw_user_meta_data->>'mobile_number','')),20),
 left(trim(coalesce(NEW.raw_user_meta_data->>'parent_name','')),120),left(trim(coalesce(NEW.raw_user_meta_data->>'roll_number','')),30),v_class_id,v_section_id,
 left(trim(coalesce(v_class_name,NEW.raw_user_meta_data->>'requested_class_name','')),80),left(trim(coalesce(v_section_name,NEW.raw_user_meta_data->>'requested_section_name','')),40));
 IF v_status='active' THEN
  INSERT INTO public.school_memberships(school_id,user_id,role,status,joined_at) VALUES(v_school_id,NEW.id,'student','active',now())
  ON CONFLICT(school_id,user_id) DO UPDATE SET role='student',status='active',joined_at=now(),removed_at=NULL,removed_by=NULL,removal_reason=NULL,updated_at=now();
 END IF;
 RETURN NEW;
END;
$function$;
