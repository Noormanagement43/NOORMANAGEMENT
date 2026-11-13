-- Real authenticated-role verification; all accounts and requests are rolled back.
begin;
set local statement_timeout='20s';
create temp table help_ids(k text primary key,id uuid not null);
insert into help_ids select k,gen_random_uuid() from unnest(array['creator','principal','teacher','student','peer','foreign','school','other_school']) k;
grant select,insert,update on help_ids to authenticated;
insert into auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
 select id,'authenticated','authenticated','help-rollback-'||id||'@example.invalid',now(),'{}','{"role":"principal"}',now(),now() from help_ids where k not in ('school','other_school');
update public.profiles pr set full_name='Verified Help '||h.k from help_ids h where h.id=pr.id;
update private.noor_creator_account set user_id=(select id from help_ids where k='creator'),email='help-rollback-'||(select id from help_ids where k='creator')||'@example.invalid',require_mfa=false;
insert into public.platform_roles(user_id,role) select id,'platform_owner' from help_ids where k='creator';
insert into public.institutions(id,name,slug,institution_type,status) select id,'Help QA '||k,'help-qa-'||id,'school','active' from help_ids where k in ('school','other_school');
insert into public.institution_memberships(institution_id,user_id,role,status)
 select (select id from help_ids where k=case when h.k='foreign' then 'other_school' else 'school' end),h.id,case when h.k in ('peer','foreign') then 'student' else h.k end,'active' from help_ids h where k in ('principal','teacher','student','peer','foreign');
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from help_ids where k='teacher'),'role','authenticated')::text,true);
set local role authenticated;
do $$declare r jsonb;p jsonb;begin
 p=jsonb_build_object('institution_id',(select id from help_ids where k='school'),'subject','Help QA teacher','body','Attendance button is difficult to find.','category','problem','sender_role','principal','sender_name','Spoofed','request_key',gen_random_uuid());
 r=public.noor_help_workspace('submit',p);insert into help_ids values('teacher_ticket',(r->>'id')::uuid);
 if not (public.noor_help_workspace('submit',p)->>'duplicate')::boolean then raise exception 'Duplicate was not idempotent';end if;
 r=public.noor_help_workspace('mine',p);if jsonb_array_length(r->'items')<>1 then raise exception 'Own teacher request missing';end if;
 begin perform public.noor_help_workspace('creator-list','{}');raise exception 'FAIL: Teacher accessed creator list';exception when insufficient_privilege then null;end;
 begin perform public.noor_help_workspace('creator-reply',jsonb_build_object('id',(select id from help_ids where k='teacher_ticket'),'reply','Fake','status','resolved'));raise exception 'FAIL: Teacher replied as creator';exception when insufficient_privilege then null;end;
 begin perform public.noor_help_workspace('mine',jsonb_build_object('institution_id',(select id from help_ids where k='other_school')));raise exception 'FAIL: Foreign school accepted';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$begin
 if not exists(select 1 from public.noor_creator_support where id=(select id from help_ids where k='teacher_ticket') and sender_role='teacher' and sender_name='Verified Help teacher') then raise exception 'Sender identity was not derived from membership and profile';end if;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from help_ids where k='principal'),'role','authenticated')::text,true);
set local role authenticated;
select public.noor_creator_inbox('support',jsonb_build_object('institution_id',(select id from help_ids where k='school'),'subject','Help QA principal','body','Please add a class report.','category','idea'));
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from help_ids where k='student'),'role','authenticated')::text,true);
do $$declare r jsonb;begin
 r=public.noor_help_workspace('submit',jsonb_build_object('institution_id',(select id from help_ids where k='school'),'subject','Help QA student','body','Please add practice questions.','category','suggestion','request_key',gen_random_uuid()));insert into help_ids values('student_ticket',(r->>'id')::uuid);
 r=public.noor_help_workspace('mine',jsonb_build_object('institution_id',(select id from help_ids where k='school')));if jsonb_array_length(r->'items')<>1 then raise exception 'Student can see another sender';end if;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from help_ids where k='peer'),'role','authenticated')::text,true);
do $$declare r jsonb;begin
 r=public.noor_help_workspace('mine',jsonb_build_object('institution_id',(select id from help_ids where k='school')));if jsonb_array_length(r->'items')<>0 then raise exception 'Peer read another request';end if;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from help_ids where k='creator'),'role','authenticated')::text,true);
do $$declare r jsonb;begin
 r=public.noor_help_workspace('creator-list','{"role":"teacher"}');
 if exists(select 1 from jsonb_array_elements(r->'items') t where t->>'sender_role'<>'teacher') then raise exception 'Teacher role filter leaked another role';end if;
 if not exists(select 1 from jsonb_array_elements(r->'items') t where t->>'id'=(select id::text from help_ids where k='teacher_ticket') and t->>'school_name'='Help QA school') then raise exception 'Creator missing school and teacher request';end if;
 r=public.noor_help_workspace('creator-list','{"role":"student"}');if not exists(select 1 from jsonb_array_elements(r->'items') t where t->>'id'=(select id::text from help_ids where k='student_ticket')) then raise exception 'Student filter missing request';end if;
 perform public.noor_help_workspace('creator-reply',jsonb_build_object('id',(select id from help_ids where k='student_ticket'),'reply','Thank you. We are reviewing your suggestion.','status','resolved'));
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from help_ids where k='student'),'role','authenticated')::text,true);
do $$declare r jsonb;blocked boolean=false;begin
 r=public.noor_help_workspace('mine',jsonb_build_object('institution_id',(select id from help_ids where k='school')));
 if r->'items'->0->>'status'<>'resolved' or r->'items'->0->>'reply'<>'Thank you. We are reviewing your suggestion.' then raise exception 'Creator reply did not reach sender';end if;
 for n in 1..4 loop perform public.noor_help_workspace('submit',jsonb_build_object('institution_id',(select id from help_ids where k='school'),'subject','QA limit '||n,'body','Fixture only','request_key',gen_random_uuid()));end loop;
 begin perform public.noor_help_workspace('submit',jsonb_build_object('institution_id',(select id from help_ids where k='school'),'subject','QA limit 6','body','Fixture only'));exception when raise_exception then blocked=true;end;
 if not blocked then raise exception 'Rate limit failed';end if;
end $$;
reset role;
update public.institution_memberships set status='revoked' where user_id=(select id from help_ids where k='teacher');
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from help_ids where k='teacher'),'role','authenticated')::text,true);
set local role authenticated;
do $$begin
 begin perform public.noor_help_workspace('mine',jsonb_build_object('institution_id',(select id from help_ids where k='school')));raise exception 'FAIL: Revoked member accessed support';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
select 'PASS: all roles submit, verified identity, retries, own history, school isolation, creator role filters, replies, rate limit, revoked membership' as verification;
