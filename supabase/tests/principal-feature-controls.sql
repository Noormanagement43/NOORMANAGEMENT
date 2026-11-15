-- Reversible test accounts and schools; no real settings are changed.
begin;
insert into auth.users(id,email) values
 ('fc000000-0000-4000-8000-000000000001','controls-principal@example.invalid'),
 ('fc000000-0000-4000-8000-000000000002','controls-teacher@example.invalid');
insert into public.profiles(id,full_name) values
 ('fc000000-0000-4000-8000-000000000001','Controls Principal'),
 ('fc000000-0000-4000-8000-000000000002','Controls Teacher') on conflict(id) do nothing;
insert into public.institutions(id,name,slug,institution_type,status) values
 ('fc100000-0000-4000-8000-000000000001','Feature School One','feature-test-one','school','active'),
 ('fc100000-0000-4000-8000-000000000002','Feature School Two','feature-test-two','school','active');
insert into public.institution_memberships(institution_id,user_id,role,status) values
 ('fc100000-0000-4000-8000-000000000001','fc000000-0000-4000-8000-000000000001','principal','active'),
 ('fc100000-0000-4000-8000-000000000001','fc000000-0000-4000-8000-000000000002','teacher','active');
-- Ensure tests are independent of the owner's real platform defaults.
insert into public.noor_feature_overrides(institution_id,feature_key,enabled)
 select i,k,true from unnest(array['fc100000-0000-4000-8000-000000000001'::uuid,'fc100000-0000-4000-8000-000000000002'::uuid]) i
 cross join unnest(array['calendar','notices','library','smart_notes','attendance']) k;
insert into public.noor_calendar_events(institution_id,title,kind,starts_at,ends_at,created_by) values
 ('fc100000-0000-4000-8000-000000000001','Event test','event',now(),now(),'fc000000-0000-4000-8000-000000000001'),
 ('fc100000-0000-4000-8000-000000000001','Notice test','notice',now(),now(),'fc000000-0000-4000-8000-000000000001');
set local role authenticated;
set local request.jwt.claim.sub='fc000000-0000-4000-8000-000000000001';
select public.noor_school_features('fc100000-0000-4000-8000-000000000001','{"calendar":false,"library":false}');
do $$ declare a jsonb; begin
 a:=public.noor_feature_access('fc100000-0000-4000-8000-000000000001');
 assert a->'features'->>'calendar'='false','School switch not enforced';
 assert a->'features'->>'smart_notes'='false','Library dependency bypassed';
 assert a->'features'->>'notices'='true','Calendar disabled notices';
 assert not exists(select 1 from public.noor_calendar_events where title='Event test' and institution_id='fc100000-0000-4000-8000-000000000001'),'Calendar data readable while OFF';
 assert exists(select 1 from public.noor_calendar_events where title='Notice test' and institution_id='fc100000-0000-4000-8000-000000000001'),'Notice was hidden by Calendar switch';
 begin perform public.noor_school_features('fc100000-0000-4000-8000-000000000002','{"calendar":false}');raise exception 'Cross-school mutation allowed';exception when insufficient_privilege then null;end;
 begin update public.noor_school_feature_settings set enabled=true;raise exception 'Direct setting update allowed';exception when insufficient_privilege then null;end;
 begin insert into public.noor_calendar_events(institution_id,title,kind,starts_at,ends_at,created_by) values('fc100000-0000-4000-8000-000000000001','Blocked event','event',now(),now(),auth.uid());raise exception 'Calendar write allowed while OFF';exception when insufficient_privilege then null;end;
end $$;
select public.noor_school_features('fc100000-0000-4000-8000-000000000001','{"calendar":true}');
do $$ begin assert (public.noor_feature_access('fc100000-0000-4000-8000-000000000001')->'features'->>'calendar')::boolean,'Principal could not reenable Calendar';end $$;
reset role;
update public.noor_feature_overrides set enabled=false where institution_id='fc100000-0000-4000-8000-000000000001' and feature_key='calendar';
set local role authenticated;
do $$ begin
 begin perform public.noor_school_features('fc100000-0000-4000-8000-000000000001','{"calendar":true}');raise exception 'Creator denial bypassed';exception when insufficient_privilege then null;end;
 assert public.noor_feature_access('fc100000-0000-4000-8000-000000000001')->'features'->>'calendar'='false','Creator denial not effective';
end $$;
set local request.jwt.claim.sub='fc000000-0000-4000-8000-000000000002';
do $$ begin
 begin perform public.noor_school_features('fc100000-0000-4000-8000-000000000001','{"attendance":false}');raise exception 'Teacher could alter features';exception when insufficient_privilege then null;end;
 assert not exists(select 1 from public.noor_school_feature_settings where institution_id='fc100000-0000-4000-8000-000000000002'),'Other school preferences visible';
end $$;
reset role;
do $$ begin assert private.noor_feature_enabled('fc100000-0000-4000-8000-000000000002','calendar'),'School One changed School Two';end $$;
rollback;
