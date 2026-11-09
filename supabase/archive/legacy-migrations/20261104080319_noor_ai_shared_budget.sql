-- Server-controlled per-institution spend guards. These are configurable request
-- budgets, not enrolment/capacity limits. No provider secrets are stored here.
CREATE TABLE private.noor_ai_limits (
 institution_id uuid PRIMARY KEY REFERENCES public.institutions(id) ON DELETE CASCADE,
 per_user_daily integer NOT NULL DEFAULT 100 CHECK(per_user_daily BETWEEN 1 AND 100000),
 per_institution_daily integer NOT NULL DEFAULT 1000 CHECK(per_institution_daily BETWEEN 1 AND 10000000)
);
CREATE TABLE private.noor_ai_daily_usage (
 institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
 usage_date date NOT NULL,
 actor_id uuid NOT NULL,
 units integer NOT NULL CHECK(units>=0),
 PRIMARY KEY(institution_id,usage_date,actor_id)
);
REVOKE ALL ON private.noor_ai_limits,private.noor_ai_daily_usage FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION private.noor_take_ai_budget(p_institution uuid,p_units integer DEFAULT 1)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$ DECLARE v_user_limit int:=100; v_tenant_limit int:=1000; v_user_units int; v_tenant_units int;
BEGIN
 IF auth.uid() IS NULL OR NOT private.is_active_member(p_institution) OR p_units NOT BETWEEN 1 AND 2 THEN RETURN false; END IF;
 IF NOT private.noor_consume_limit('ai_requests',8) THEN RETURN false; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_institution::text,2));
 SELECT per_user_daily,per_institution_daily INTO v_user_limit,v_tenant_limit FROM private.noor_ai_limits WHERE institution_id=p_institution;
 v_user_limit:=coalesce(v_user_limit,100); v_tenant_limit:=coalesce(v_tenant_limit,1000);
 SELECT coalesce(sum(units),0),coalesce(sum(units) FILTER(WHERE actor_id=auth.uid()),0)
 INTO v_tenant_units,v_user_units FROM private.noor_ai_daily_usage WHERE institution_id=p_institution AND usage_date=(now() AT TIME ZONE 'UTC')::date;
 IF v_user_units+p_units>v_user_limit OR v_tenant_units+p_units>v_tenant_limit THEN RETURN false; END IF;
 INSERT INTO private.noor_ai_daily_usage(institution_id,usage_date,actor_id,units)
 VALUES(p_institution,(now() AT TIME ZONE 'UTC')::date,auth.uid(),p_units)
 ON CONFLICT(institution_id,usage_date,actor_id) DO UPDATE SET units=private.noor_ai_daily_usage.units+EXCLUDED.units;
 RETURN true;
END $$;
CREATE OR REPLACE FUNCTION public.noor_take_ai_budget(p_institution uuid,p_units integer DEFAULT 1)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.noor_take_ai_budget(p_institution,p_units); $$;
REVOKE ALL ON FUNCTION private.noor_take_ai_budget(uuid,integer),public.noor_take_ai_budget(uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.noor_take_ai_budget(uuid,integer),public.noor_take_ai_budget(uuid,integer) TO authenticated;
