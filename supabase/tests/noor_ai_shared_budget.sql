-- Run AFTER noor_backend_workflows.sql inside the SAME BEGIN/ROLLBACK transaction.
INSERT INTO private.noor_ai_limits(institution_id,per_user_daily,per_institution_daily) VALUES('42000000-0000-4000-8000-000000000001',2,3);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000003',true);
DO $$ BEGIN
 IF public.noor_take_ai_budget('42000000-0000-4000-8000-000000000002',1) THEN RAISE EXCEPTION 'Cross-tenant AI budget accepted'; END IF;
 IF NOT public.noor_take_ai_budget('42000000-0000-4000-8000-000000000001',1) OR NOT public.noor_take_ai_budget('42000000-0000-4000-8000-000000000001',1) THEN RAISE EXCEPTION 'AI budget unexpectedly denied'; END IF;
 IF public.noor_take_ai_budget('42000000-0000-4000-8000-000000000001',1) THEN RAISE EXCEPTION 'Per-user AI daily budget bypassed'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000002',true);
DO $$ BEGIN
 IF NOT public.noor_take_ai_budget('42000000-0000-4000-8000-000000000001',1) THEN RAISE EXCEPTION 'Tenant remaining budget not available'; END IF;
 IF public.noor_take_ai_budget('42000000-0000-4000-8000-000000000001',1) THEN RAISE EXCEPTION 'Tenant AI budget bypassed'; END IF;
END $$;
RESET ROLE;
SELECT 'PASS: AI user budget, tenant budget and cross-tenant denial' as result;
