-- Pre-login recovery throttles. Store only SHA-256 digests, never emails, IPs or OTPs.
CREATE TABLE IF NOT EXISTS private.noor_auth_recovery_limits(
 bucket text PRIMARY KEY,window_start timestamptz NOT NULL,hits integer NOT NULL);
ALTER TABLE private.noor_auth_recovery_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.noor_auth_recovery_limits FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON private.noor_auth_recovery_limits TO service_role;
CREATE OR REPLACE FUNCTION public.noor_auth_recovery_limit(p_email text,p_ip text) RETURNS boolean
 LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE item record; n integer; allowed boolean:=true; start_at timestamptz:=date_trunc('hour',now());
BEGIN
 IF p_email !~ '^[a-f0-9]{64}$' OR p_ip !~ '^[a-f0-9]{64}$' OR p_email IS NULL OR p_ip IS NULL THEN RETURN false; END IF;
 FOR item IN SELECT * FROM (VALUES ('email:'||p_email,3),('ip:'||p_ip,20),('global',200)) AS limits(bucket,max_hits) ORDER BY bucket LOOP
  INSERT INTO private.noor_auth_recovery_limits(bucket,window_start,hits) VALUES(item.bucket,start_at,1)
  ON CONFLICT(bucket) DO UPDATE SET window_start=EXCLUDED.window_start,hits=CASE WHEN private.noor_auth_recovery_limits.window_start=start_at THEN private.noor_auth_recovery_limits.hits+1 ELSE 1 END RETURNING hits INTO n;
  IF n>item.max_hits THEN allowed:=false; END IF;
 END LOOP;
 DELETE FROM private.noor_auth_recovery_limits WHERE window_start<now()-interval '2 days';
 RETURN allowed;
END $$;
REVOKE ALL ON FUNCTION public.noor_auth_recovery_limit(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.noor_auth_recovery_limit(text,text) TO service_role;
NOTIFY pgrst,'reload schema';
