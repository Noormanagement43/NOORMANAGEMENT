-- Protect school approval fields, official email verification, ownership and leadership membership status.
CREATE OR REPLACE FUNCTION private.noor_guard_school_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN RAISE EXCEPTION 'School ID and original creator are immutable' USING errcode='42501'; END IF;
 IF (NEW.verification_status IS DISTINCT FROM OLD.verification_status OR NEW.account_status IS DISTINCT FROM OLD.account_status
 OR NEW.verified_at IS DISTINCT FROM OLD.verified_at OR NEW.verified_by IS DISTINCT FROM OLD.verified_by
 OR NEW.official_email_verified_at IS DISTINCT FROM OLD.official_email_verified_at OR NEW.is_active IS DISTINCT FROM OLD.is_active
 OR NEW.official_email IS DISTINCT FROM OLD.official_email OR NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id)
 AND NOT private.is_creator() AND current_setting('noor.accepting_invitation',true) IS DISTINCT FROM 'on' THEN
  RAISE EXCEPTION 'School verification, owner assignment and official-email identity changes require authorised platform administration' USING errcode='42501';
 END IF;
 IF (NEW.join_code IS DISTINCT FROM OLD.join_code OR NEW.secret_code_hash IS DISTINCT FROM OLD.secret_code_hash
 OR NEW.secret_code_rotated_at IS DISTINCT FROM OLD.secret_code_rotated_at OR NEW.master_key_hash IS DISTINCT FROM OLD.master_key_hash)
 AND NOT private.is_creator() AND current_setting('noor.allow_school_secret_change',true) IS DISTINCT FROM 'on' THEN
  RAISE EXCEPTION 'School codes and privileged recovery credentials must be changed through the secure rotation flow' USING errcode='42501';
 END IF;
 RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION private.noor_guard_school_membership()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'School memberships are historical records; mark them removed instead of deleting' USING errcode='42501'; END IF;
 IF TG_OP='INSERT' THEN
  IF auth.uid() IS NULL OR current_setting('noor.accepting_invitation',true)='on' THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Memberships must be created by the trusted invitation or provisioning flow' USING errcode='42501';
 END IF;
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.school_id IS DISTINCT FROM OLD.school_id OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN RAISE EXCEPTION 'Membership identity is immutable' USING errcode='42501'; END IF;
 IF NEW.role IS DISTINCT FROM OLD.role AND current_setting('noor.accepting_invitation',true) IS DISTINCT FROM 'on' AND NOT private.is_creator() THEN
  RAISE EXCEPTION 'Membership roles can only be assigned by a trusted invitation or platform administration' USING errcode='42501';
 END IF;
 IF NEW.status IS DISTINCT FROM OLD.status AND OLD.role IN ('owner','principal','manager') AND NOT private.is_creator()
 AND NOT private.has_school_role(OLD.school_id,ARRAY['owner']) THEN
  RAISE EXCEPTION 'Only the School Owner or platform administration can change leadership membership status' USING errcode='42501';
 END IF;
 IF NEW.status IS DISTINCT FROM OLD.status AND current_setting('noor.accepting_invitation',true) IS DISTINCT FROM 'on' AND auth.uid() IS NOT NULL
 AND NOT private.is_creator() AND NOT private.noor_can_school_permission(OLD.school_id,'manage_staff') THEN
  RAISE EXCEPTION 'You are not authorised to change this membership status' USING errcode='42501';
 END IF;
 NEW.updated_at:=now(); RETURN NEW;
END;
$function$;
