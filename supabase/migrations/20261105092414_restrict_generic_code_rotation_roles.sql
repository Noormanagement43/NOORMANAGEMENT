-- Existing generic rotation must not gain management-code privileges through the expanded role check.
CREATE OR REPLACE FUNCTION private.noor_rotate_join_code(p_institution uuid,p_role text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_code text:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
BEGIN
 IF auth.uid() IS NULL OR NOT private.can_manage_academics(p_institution) THEN RAISE EXCEPTION 'Institution leadership required' USING ERRCODE='42501'; END IF;
 IF p_role IS NULL OR p_role NOT IN ('student','teacher') THEN RAISE EXCEPTION 'Use leadership code settings for management access' USING ERRCODE='42501'; END IF;
 IF NOT private.noor_consume_limit('rotate_join_code',10) THEN RAISE EXCEPTION 'Rate limit exceeded' USING ERRCODE='54000'; END IF;
 INSERT INTO private.noor_join_codes(institution_id,role,code_hash,expires_at)
 VALUES(p_institution,p_role,encode(sha256(convert_to(v_code,'UTF8')),'hex'),now()+interval '30 days')
 ON CONFLICT(institution_id,role) DO UPDATE SET code_hash=EXCLUDED.code_hash,expires_at=EXCLUDED.expires_at;
 INSERT INTO public.noor_audit_events(institution_id,actor_id,action,metadata) VALUES(p_institution,auth.uid(),'joining_code.rotated',jsonb_build_object('role',p_role));
 RETURN v_code;
END $$;
