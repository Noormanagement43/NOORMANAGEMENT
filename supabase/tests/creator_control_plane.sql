-- Real authorization/RLS checks; all fixture users, records and messages roll back.
begin;
insert into auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('cd000000-0000-4000-8000-000000000001','authenticated','authenticated','creator-test@noor.invalid',now(),'{}','{}',now(),now()),
('cd000000-0000-4000-8000-000000000002','authenticated','authenticated','principal-a@noor.invalid',now(),'{}','{}',now(),now()),
('cd000000-0000-4000-8000-000000000003','authenticated','authenticated','principal-b@noor.invalid',now(),'{}','{}',now(),now());
update private.noor_creator_account set user_id='cd000000-0000-4000-8000-000000000001',email='creator-test@noor.invalid';
insert into public.platform_roles(user_id,role) values('cd000000-0000-4000-8000-000000000001','platform_owner');
insert into public.institutions(id,name,slug,institution_type,status) values
('ce000000-0000-4000-8000-000000000001','Creator QA School A','creator-qa-school-a','school','active'),
('ce000000-0000-4000-8000-000000000002','Creator QA College B','creator-qa-college-b','university','active');
insert into public.institution_memberships(institution_id,user_id,role,status) values
('ce000000-0000-4000-8000-000000000001','cd000000-0000-4000-8000-000000000002','principal','active'),
('ce000000-0000-4000-8000-000000000002','cd000000-0000-4000-8000-000000000003','university_admin','active');
select set_config('request.jwt.claims','{"sub":"cd000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$begin
 if public.noor_creator_identity() then raise exception 'FAIL: Principal is creator';end if;
 begin perform public.noor_creator_api('state');raise exception 'FAIL: Principal read creator state';exception when insufficient_privilege then null;end;
 begin perform public.noor_creator_api('pause','{"institution_id":"ce000000-0000-4000-8000-000000000002","paused":true}');raise exception 'FAIL: Principal paused another school';exception when insufficient_privilege then null;end;
 begin perform public.noor_feature_access('ce000000-0000-4000-8000-000000000002');raise exception 'FAIL: Cross-school access';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"cd000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$declare s jsonb;begin
 if not public.noor_creator_identity() then raise exception 'FAIL: Owner identity denied';end if;
 s=public.noor_creator_api('state');if jsonb_array_length(s->'catalog')<>24 then raise exception 'FAIL: Missing feature catalog';end if;
 perform public.noor_creator_api('features','{"scope":"selected","institution_ids":["ce000000-0000-4000-8000-000000000001"],"changes":{"classes":false,"analytics":false}}');
 perform public.noor_creator_api('billing','{"institution_id":"ce000000-0000-4000-8000-000000000001","monthly_fee":50000,"next_due":"2026-11-16"}');
 perform public.noor_creator_api('broadcast','{"request_key":"cf000000-0000-4000-8000-000000000001","scope":"selected","institution_ids":["ce000000-0000-4000-8000-000000000001"],"channels":["in_app"],"title":"QA reminder","body":"Fixture only, rolled back."}');
 -- A repeated request must not produce duplicate deliveries.
 s=public.noor_creator_api('broadcast','{"request_key":"cf000000-0000-4000-8000-000000000001","scope":"selected","institution_ids":["ce000000-0000-4000-8000-000000000001"],"channels":["in_app"],"title":"QA reminder","body":"Fixture only, rolled back."}');
 if not (s->>'duplicate')::boolean then raise exception 'FAIL: Duplicate broadcast';end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"cd000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$declare s jsonb;begin
 s=public.noor_feature_access('ce000000-0000-4000-8000-000000000001');if (s->'features'->>'classes')::boolean then raise exception 'FAIL: Selected feature enabled';end if;
 begin insert into public.academic_groups(institution_id,name,group_type) values('ce000000-0000-4000-8000-000000000001','Blocked class','class');raise exception 'FAIL: Disabled feature write';exception when insufficient_privilege then null;end;
 begin perform public.noor_live_analytics('ce000000-0000-4000-8000-000000000001');raise exception 'FAIL: Disabled analytics RPC';exception when insufficient_privilege then null;end;
 s=public.noor_creator_inbox('list','{"institution_id":"ce000000-0000-4000-8000-000000000001"}');if jsonb_array_length(s->'messages')<>1 then raise exception 'FAIL: Principal message delivery';end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"cd000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
do $$declare s jsonb;begin
 s=public.noor_feature_access('ce000000-0000-4000-8000-000000000002');if not (s->'features'->>'classes')::boolean then raise exception 'FAIL: Other institute feature changed';end if;
 s=public.noor_creator_inbox('list','{"institution_id":"ce000000-0000-4000-8000-000000000002"}');if jsonb_array_length(s->'messages')<>0 then raise exception 'FAIL: Broadcast leaked across schools';end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"cd000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select public.noor_creator_api('pause','{"institution_id":"ce000000-0000-4000-8000-000000000001","paused":true,"reason":"QA rollback"}');
reset role;
select set_config('request.jwt.claims','{"sub":"cd000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$declare s jsonb;begin
 s=public.noor_feature_access('ce000000-0000-4000-8000-000000000001');if not (s->>'paused')::boolean then raise exception 'FAIL: Pause not enforced';end if;
 if private.is_active_member('ce000000-0000-4000-8000-000000000001') then raise exception 'FAIL: Paused member access';end if;
 s=public.noor_creator_inbox('list','{"institution_id":"ce000000-0000-4000-8000-000000000001"}');if jsonb_array_length(s->'messages')<>1 then raise exception 'FAIL: Payment message hidden during pause';end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"cd000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select public.noor_creator_api('pause','{"institution_id":"ce000000-0000-4000-8000-000000000001","paused":false}');
select public.noor_creator_api('features','{"scope":"all","replace_overrides":true,"changes":{"classes":true,"analytics":true}}');
reset role;
update auth.users set email='changed-email@noor.invalid' where id='cd000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$begin if public.noor_creator_identity() then raise exception 'FAIL: Changed email still authorized';end if;end $$;
reset role;
rollback;
select 'Creator authorization, cross-school isolation, selected features, blocked writes/RPCs, idempotent messages, pause and email lock: PASS' as result;
