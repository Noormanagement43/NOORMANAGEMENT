-- Only synthetic rows; all changes are rolled back.
begin;
create temp table chat_ids(k text primary key,v uuid not null);
insert into chat_ids select k,gen_random_uuid() from unnest(array['school','other_school','student','peer','teacher','other_teacher','other','sm','peer_m','tm','otm','om','class','other_class','message']) k;
create temp table chat_results(check_name text,passed boolean);
grant select on chat_ids to authenticated;
grant insert,select on chat_results to authenticated;
insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data)
select v,'chat-test-'||v||'@example.invalid','{"full_name":"Chat test"}','{}' from chat_ids where k in ('student','peer','teacher','other_teacher','other');
insert into public.institutions(id,name,slug,institution_type,country_code,timezone,default_language,status,created_by)
select v,'Chat test school','chat-test-'||v,'school','IN','Asia/Kolkata','en','active',(select v from chat_ids where k='teacher') from chat_ids where k in ('school','other_school');
insert into public.institution_memberships(id,institution_id,user_id,role,status)
select m.v,s.v,u.v,x.role,'active' from (values('sm','school','student','student'),('peer_m','school','peer','student'),('tm','school','teacher','teacher'),('otm','school','other_teacher','teacher'),('om','other_school','other','student')) x(m,s,u,role)
join chat_ids m on m.k=x.m join chat_ids s on s.k=x.s join chat_ids u on u.k=x.u;
insert into public.academic_groups(id,institution_id,name,group_type,is_active,homeroom_teacher_membership_id)
values((select v from chat_ids where k='class'),(select v from chat_ids where k='school'),'Chat class','class',true,(select v from chat_ids where k='tm'));
insert into public.academic_group_memberships(institution_id,group_id,membership_id,group_role,status)
select (select v from chat_ids where k='school'),(select v from chat_ids where k='class'),v,'student','active' from chat_ids where k in ('sm','peer_m');
select set_config('request.jwt.claims',json_build_object('sub',(select v from chat_ids where k='student'),'role','authenticated')::text,true);
set local role authenticated;
insert into storage.objects(bucket_id,name) values('noor-chat-files',(select v from chat_ids where k='school')||'/'||(select v from chat_ids where k='student')||'/test.png');
insert into public.noor_class_questions(id,institution_id,academic_group_id,student_membership_id,recipient_teacher_membership_id,question,attachment_path,attachment_name,attachment_type)
values((select v from chat_ids where k='message'),(select v from chat_ids where k='school'),(select v from chat_ids where k='class'),(select v from chat_ids where k='sm'),(select v from chat_ids where k='tm'),'Hi',(select v from chat_ids where k='school')||'/'||(select v from chat_ids where k='student')||'/test.png','Question.png','image/png');
insert into chat_results select 'student reads own sent message and attachment',
(select count(*)=1 from public.noor_class_questions where id=(select v from chat_ids where k='message')) and (select count(*)=1 from storage.objects where bucket_id='noor-chat-files' and name like (select v::text from chat_ids where k='school')||'/%');
do $$ begin
 begin
 insert into storage.objects(bucket_id,name) values('noor-chat-files',(select v from chat_ids where k='other_school')||'/'||(select v from chat_ids where k='student')||'/test.png');
 raise exception 'Cross-school upload accepted';
 exception when insufficient_privilege then insert into chat_results values('cross-school upload blocked',true);end;
 begin
 insert into public.noor_class_questions(institution_id,academic_group_id,student_membership_id,recipient_teacher_membership_id,question,attachment_path,attachment_name,attachment_type)
 values((select v from chat_ids where k='school'),(select v from chat_ids where k='class'),(select v from chat_ids where k='sm'),(select v from chat_ids where k='tm'),'Hello',(select v from chat_ids where k='school')||'/'||(select v from chat_ids where k='peer')||'/test.png','Other.png','image/png');
 raise exception 'Another owner attachment accepted';
 exception when insufficient_privilege then insert into chat_results values('other owner attachment blocked',true);end;
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',(select v from chat_ids where k='teacher'),'role','authenticated')::text,true);
set local role authenticated;
insert into chat_results select 'recipient teacher reads message and file',(select count(*)=1 from public.noor_class_questions where id=(select v from chat_ids where k='message')) and (select count(*)=1 from storage.objects where bucket_id='noor-chat-files' and name like (select v::text from chat_ids where k='school')||'/%');
update public.noor_class_questions set reply='I can help.',replied_at=now() where id=(select v from chat_ids where k='message');
insert into chat_results select 'recipient teacher reply saved',reply='I can help.' from public.noor_class_questions where id=(select v from chat_ids where k='message');
reset role;
select set_config('request.jwt.claims',json_build_object('sub',(select v from chat_ids where k='peer'),'role','authenticated')::text,true);
set local role authenticated;
insert into chat_results select 'classmate cannot read private chat or file',(select count(*)=0 from public.noor_class_questions where id=(select v from chat_ids where k='message')) and (select count(*)=0 from storage.objects where bucket_id='noor-chat-files' and name like (select v::text from chat_ids where k='school')||'/%');
reset role;
select set_config('request.jwt.claims',json_build_object('sub',(select v from chat_ids where k='other_teacher'),'role','authenticated')::text,true);
set local role authenticated;
insert into chat_results select 'unselected teacher cannot read private chat or file',(select count(*)=0 from public.noor_class_questions where id=(select v from chat_ids where k='message')) and (select count(*)=0 from storage.objects where bucket_id='noor-chat-files' and name like (select v::text from chat_ids where k='school')||'/%');
reset role;
select set_config('request.jwt.claims',json_build_object('sub',(select v from chat_ids where k='other'),'role','authenticated')::text,true);
set local role authenticated;
insert into chat_results select 'other school cannot read private chat or file',(select count(*)=0 from public.noor_class_questions where id=(select v from chat_ids where k='message')) and (select count(*)=0 from storage.objects where bucket_id='noor-chat-files' and name like (select v::text from chat_ids where k='school')||'/%');
reset role;
select jsonb_agg(to_jsonb(chat_results)) as results from chat_results;
rollback;
