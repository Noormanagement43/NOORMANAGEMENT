-- Creator control plane. No account is granted access until the owner supplies her email.
create table private.noor_creator_account (
 singleton boolean primary key default true check(singleton),
 user_id uuid unique references auth.users(id),
 email text unique check(email=lower(btrim(email))),
 require_mfa boolean not null default false,
 check((user_id is null)=(email is null))
);
insert into private.noor_creator_account(singleton) values(true);
revoke all on private.noor_creator_account from public,anon,authenticated;
create or replace function private.is_platform_admin() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
 select 1 from private.noor_creator_account c join auth.users u on u.id=c.user_id
 where c.singleton and c.user_id=auth.uid() and lower(u.email)=c.email and u.email_confirmed_at is not null
 and exists(select 1 from public.platform_roles r where r.user_id=u.id and r.role='platform_owner')
 and (not c.require_mfa or auth.jwt()->>'aal'='aal2'))
$$;
revoke all on function private.is_platform_admin() from public,anon;
grant execute on function private.is_platform_admin() to authenticated;
create function public.noor_creator_identity() returns boolean language sql stable security invoker set search_path='' as $$ select private.is_platform_admin() $$;
revoke all on function public.noor_creator_identity() from public,anon;
grant execute on function public.noor_creator_identity() to authenticated;

create table public.noor_feature_catalog(feature_key text primary key,label text not null,category text not null,description text not null);
insert into public.noor_feature_catalog values
('attendance','Student Attendance','Academics','Attendance marking and attendance records'),
('staff_attendance','Teacher Attendance','People','Staff check-in and attendance'),
('classes','Classes and Sections','Academics','Class, section and stream management'),
('teachers','Teacher Management','People','Teacher and staff management'),
('students','Student Management','People','Student management and enrollment'),
('timetable','Timetable and Periods','Academics','Schedules, time slots and daily lessons'),
('marks','Student Marks','Academics','Marks entry and academic results'),
('report_cards','Report Cards','Academics','Term report cards and progress reports'),
('annual_cards','Annual Cards','Academics','Annual consolidated report cards'),
('weekly_tests','Weekly Tests','Academics','Weekly online tests and attempts'),
('monthly_tests','Monthly Tests','Academics','Monthly test papers and attempts'),
('exams','Exams','Academics','Exam papers and attempts'),
('assignments','Assignments and Homework','Learning','Class assignments and submissions'),
('smart_notes','Smart Notes','Learning','Revision, smart notes and recorded lessons'),
('library','Learning Library','Learning','Published learning materials'),
('ai_assistant','AI Assistant','AI','AI assistance and generation'),
('analytics','Analytics and Live Insights','AI','Role-based progress and attendance insights'),
('notices','Notices and Meetings','Communication','School notices and meetings'),
('email','Email','Communication','External school email campaigns'),
('parent_communication','Parent Communication','Communication','Guardian links and parent support'),
('calendar','Calendar','Academics','School calendar and holidays'),
('profile_edit','Profile Editing','People','Profile and personal preferences'),
('school_settings','School Settings','Other','Branding and school appearance'),
('diary','Teaching Diary and Plans','Learning','Teaching plans, class questions and tasks');
create table public.noor_feature_defaults(feature_key text primary key references public.noor_feature_catalog,enabled boolean not null default true);
insert into public.noor_feature_defaults select feature_key,true from public.noor_feature_catalog;
create table public.noor_feature_overrides(institution_id uuid references public.institutions on delete cascade,feature_key text references public.noor_feature_catalog,enabled boolean not null,primary key(institution_id,feature_key));
create table public.noor_institute_billing(
 institution_id uuid primary key references public.institutions on delete cascade,
 monthly_fee numeric(12,2) check(monthly_fee>=0),next_due date,last_paid_due date,
 grace_days integer not null default 3 check(grace_days between 0 and 90),paused boolean not null default false,
 paused_at timestamptz,pause_reason text,updated_at timestamptz not null default now()
);
create table public.noor_creator_payments(
 id uuid primary key default gen_random_uuid(),institution_id uuid not null references public.institutions,
 amount numeric(12,2) not null check(amount>0),paid_on date not null,due_for date not null,reference text,
 created_by uuid not null references auth.users,created_at timestamptz not null default now(),request_key uuid not null unique
);
create table public.noor_creator_activity(id bigint generated always as identity primary key,actor_id uuid references auth.users,action text not null,institution_ids uuid[],details jsonb not null default '{}',created_at timestamptz not null default now());
create table public.noor_creator_broadcasts(
 id uuid primary key default gen_random_uuid(),created_by uuid not null references auth.users,request_key uuid not null unique,
 title text not null check(length(btrim(title)) between 1 and 180),body text not null check(length(btrim(body)) between 1 and 20000),
 channels text[] not null check(cardinality(channels)>0 and channels<@array['in_app','email']::text[]),
 institution_ids uuid[] not null check(cardinality(institution_ids)>0),send_at timestamptz not null default now(),created_at timestamptz not null default now()
);
create table public.noor_creator_deliveries(
 id uuid primary key default gen_random_uuid(),broadcast_id uuid not null references public.noor_creator_broadcasts,
 institution_id uuid not null references public.institutions,recipient_id uuid not null references auth.users,
 published_at timestamptz,read_at timestamptz,email_status text not null default 'none' check(email_status in ('none','queued','sending','accepted','failed','skipped')),
 attempts integer not null default 0,retry_at timestamptz not null default now(),provider_id text,error_code text,
 unique(broadcast_id,recipient_id,institution_id)
);
create index noor_creator_delivery_recipient on public.noor_creator_deliveries(recipient_id,read_at);
create index noor_creator_delivery_queue on public.noor_creator_deliveries(email_status,retry_at);
create table public.noor_creator_support(
 id uuid primary key default gen_random_uuid(),institution_id uuid not null references public.institutions,created_by uuid not null references auth.users,
 subject text not null check(length(subject) between 1 and 180),body text not null check(length(body) between 1 and 20000),status text not null default 'open' check(status in ('open','resolved')),
 reply text,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
do $$ declare t text; begin
 foreach t in array array['noor_feature_catalog','noor_feature_defaults','noor_feature_overrides','noor_institute_billing','noor_creator_payments','noor_creator_activity','noor_creator_broadcasts','noor_creator_deliveries','noor_creator_support'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;

create function private.noor_institute_running(p_inst uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.institutions i where i.id=p_inst and i.status='active') and not coalesce((select b.paused from public.noor_institute_billing b where b.institution_id=p_inst),false)
$$;
create function private.noor_feature_enabled(p_inst uuid,p_key text) returns boolean language sql stable security definer set search_path='' as $$
 select private.noor_institute_running(p_inst) and coalesce(
 (select o.enabled from public.noor_feature_overrides o where o.institution_id=p_inst and o.feature_key=p_key),
 (select d.enabled from public.noor_feature_defaults d where d.feature_key=p_key),true)
$$;
revoke all on function private.noor_institute_running(uuid),private.noor_feature_enabled(uuid,text) from public,anon;
grant execute on function private.noor_institute_running(uuid),private.noor_feature_enabled(uuid,text) to authenticated,service_role;
create or replace function private.is_active_member(_institution_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.noor_institute_running(_institution_id) and exists(select 1 from public.institution_memberships m where m.institution_id=_institution_id and m.user_id=auth.uid() and m.status='active')
$$;
create or replace function private.has_institution_role(_institution_id uuid,_roles text[]) returns boolean language sql stable security definer set search_path='' as $$
 select private.noor_institute_running(_institution_id) and exists(select 1 from public.institution_memberships m where m.institution_id=_institution_id and m.user_id=auth.uid() and m.status='active' and m.role=any(_roles))
$$;

-- Guards apply even inside security-definer RPC writes. Backend workers with no user session
-- are trusted; public calls remain authenticated and retain their existing tenant policies.
create function private.noor_row_feature(p_table text,p_row jsonb) returns text language sql stable security definer set search_path='' as $$
 select case p_table
 when 'attendance_records' then 'attendance' when 'class_sessions' then 'timetable' when 'teacher_timetable_periods' then 'timetable'
 when 'institution_period_slots' then 'timetable' when 'noor_daily_period_lessons' then 'timetable'
 when 'academic_groups' then 'classes' when 'academic_group_memberships' then 'classes'
 when 'noor_staff_checkins' then 'staff_attendance' when 'noor_assessment_results' then 'marks'
 when 'noor_report_settings' then 'report_cards' when 'noor_group_report_settings' then 'report_cards'
 when 'noor_weekly_quizzes' then case when p_row->>'assessment_kind'='monthly' then 'monthly_tests' when p_row->>'assessment_kind'='exam' then 'exams' else 'weekly_tests' end
 when 'noor_quiz_attempts' then coalesce((select case q.assessment_kind when 'monthly' then 'monthly_tests' when 'exam' then 'exams' else 'weekly_tests' end from public.noor_weekly_quizzes q where q.id=(p_row->>'quiz_id')::uuid),'weekly_tests')
 when 'noor_test_rules' then case when p_row->>'exam_key'='monthly' then 'monthly_tests' when p_row->>'exam_key'='weekly' then 'weekly_tests' else 'exams' end
 when 'noor_assignment_submissions' then 'assignments'
 when 'noor_learning_items' then case when p_row->>'kind'='assignment' then 'assignments' else 'smart_notes' end
 when 'noor_calendar_events' then 'calendar' when 'noor_guardian_links' then 'parent_communication'
 when 'noor_school_messages' then 'notices' when 'noor_school_campaigns' then 'email' when 'noor_email_queue' then 'email'
 when 'institution_branding' then 'school_settings' when 'noor_school_appearance' then 'school_settings' when 'institution_dashboard_preferences' then 'school_settings'
 when 'noor_teacher_weekly_plans' then 'diary' when 'noor_principal_tasks' then 'diary' when 'noor_class_questions' then 'diary'
 when 'institution_memberships' then case when p_row->>'role' in ('student','university_student') then 'students' else 'teachers' end
 when 'ai_generation_jobs' then 'ai_assistant' when 'noor_workflow_jobs' then 'ai_assistant' else 'platform' end
$$;
create function private.noor_guard_write() returns trigger language plpgsql security definer set search_path='' as $$
 declare r jsonb; inst uuid; feature text; begin
 if auth.uid() is null or private.is_platform_admin() then if tg_op='DELETE' then return old; else return new; end if; end if;
 if tg_op='DELETE' then r=to_jsonb(old); else r=to_jsonb(new); end if;
 inst=(r->>'institution_id')::uuid;
 feature=private.noor_row_feature(tg_table_name,r);
 if tg_table_name='profiles' then
 if exists(select 1 from public.institution_memberships m where m.user_id=auth.uid() and m.status='active' and not private.noor_feature_enabled(m.institution_id,'profile_edit')) then raise exception 'Profile editing is disabled by NOOR' using errcode='42501'; end if;
 elsif inst is not null and not private.noor_feature_enabled(inst,feature) then raise exception 'This feature or institute access is paused by NOOR' using errcode='42501'; end if;
 if tg_op='DELETE' then return old; else return new; end if;
 end $$;
revoke all on function private.noor_row_feature(text,jsonb),private.noor_guard_write() from public,anon,authenticated;
-- All tenant tables: restrictive policies preserve original ownership restrictions.
do $$ declare t record; begin
 for t in select distinct table_name from information_schema.columns where table_schema='public' and column_name='institution_id' and table_name not like 'noor_creator_%' and table_name not like 'noor_feature_%' and table_name<>'noor_institute_billing' loop
 execute format('create policy noor_creator_feature_read on public.%I as restrictive for select to authenticated using (private.is_platform_admin() or %L=''institution_memberships'' or private.noor_feature_enabled(institution_id,private.noor_row_feature(%L,to_jsonb(%I))))',t.table_name,t.table_name,t.table_name,t.table_name);
 execute format('create trigger noor_creator_feature_write before insert or update or delete on public.%I for each row execute function private.noor_guard_write()',t.table_name);
 end loop;
end $$;
grant execute on function private.noor_row_feature(text,jsonb) to authenticated;
create trigger noor_creator_profile_write before update on public.profiles for each row execute function private.noor_guard_write();

-- The caller may only retrieve its own institute's effective access; no cross-school data.
create function private.noor_access_state(p_inst uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
 begin
 if auth.uid() is null or not exists(select 1 from public.institution_memberships m where m.institution_id=p_inst and m.user_id=auth.uid() and m.status='active') then raise exception 'Institute membership required' using errcode='42501'; end if;
 return jsonb_build_object('paused',not private.noor_institute_running(p_inst),'features',(select jsonb_object_agg(c.feature_key,private.noor_feature_enabled(p_inst,c.feature_key)) from public.noor_feature_catalog c));
 end $$;
create function public.noor_feature_access(p_institution uuid) returns jsonb language sql stable security invoker set search_path='' as $$ select private.noor_access_state(p_institution) $$;
revoke all on function private.noor_access_state(uuid),public.noor_feature_access(uuid) from public,anon;
grant execute on function private.noor_access_state(uuid),public.noor_feature_access(uuid) to authenticated;

create function private.noor_creator_dispatch(p_action text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
 declare ids uuid[]; inst uuid; k text; v boolean; bid uuid; n integer; output jsonb; invoice_date date;
 begin
 if not private.is_platform_admin() then raise exception 'Authorized NOOR creator account required' using errcode='42501'; end if;
 if p_action='state' then
 return jsonb_build_object(
 'institutes',(select coalesce(jsonb_agg(x order by x.created_at desc),'[]') from (
 select i.id,i.name,i.institution_type,i.status,i.country_code,i.created_at,
 coalesce(b.paused,false) paused,b.monthly_fee,b.next_due,b.last_paid_due,b.grace_days,b.pause_reason,
 (select count(*) from public.institution_memberships m where m.institution_id=i.id and m.status not in ('revoked','invited') and m.role in ('student','university_student')) students,
 (select count(*) from public.institution_memberships m where m.institution_id=i.id and m.status not in ('revoked','invited') and m.role in ('teacher','faculty')) teachers,
 (select count(*) from public.academic_groups g where g.institution_id=i.id and g.is_active and g.group_type='class') classes,
 (select count(*) from public.academic_groups g where g.institution_id=i.id and g.is_active and g.group_type='section') sections,
 (select logo_path from public.institution_branding z where z.institution_id=i.id) logo_path,
 (select jsonb_agg(jsonb_build_object('name',pr.full_name,'email',u.email,'user_id',m.user_id)) from public.institution_memberships m join public.profiles pr on pr.id=m.user_id join auth.users u on u.id=m.user_id where m.institution_id=i.id and m.status='active' and m.role in ('principal','university_admin')) principals
 from public.institutions i left join public.noor_institute_billing b on b.institution_id=i.id) x),
 'catalog',(select jsonb_agg(c order by c.category,c.label) from public.noor_feature_catalog c),
 'defaults',(select jsonb_agg(d) from public.noor_feature_defaults d),
 'overrides',(select coalesce(jsonb_agg(o),'[]') from public.noor_feature_overrides o),
 'payments',(select coalesce(jsonb_agg(x),'[]') from (select * from public.noor_creator_payments order by created_at desc limit 100) x),
 'activity',(select coalesce(jsonb_agg(x),'[]') from (select * from public.noor_creator_activity order by id desc limit 100) x),
 'broadcasts',(select coalesce(jsonb_agg(x),'[]') from (select b.*,
 (select count(*) from public.noor_creator_deliveries d where d.broadcast_id=b.id) recipients,
 (select count(*) from public.noor_creator_deliveries d where d.broadcast_id=b.id and d.read_at is not null) read_count,
 (select count(*) from public.noor_creator_deliveries d where d.broadcast_id=b.id and d.email_status='accepted') accepted_count,
 (select count(*) from public.noor_creator_deliveries d where d.broadcast_id=b.id and d.email_status='failed') failed_count
 from public.noor_creator_broadcasts b order by created_at desc limit 60) x),
 'support',(select coalesce(jsonb_agg(x),'[]') from (select * from public.noor_creator_support order by created_at desc limit 100) x),
 'owner',(select jsonb_build_object('email',email,'require_mfa',require_mfa) from private.noor_creator_account where singleton));
 end if;
 if p_action in ('pause','billing','payment') then
 inst=(p->>'institution_id')::uuid;
 if inst is null or not exists(select 1 from public.institutions where id=inst) then raise exception 'Institute not found'; end if;
 ids=array[inst];
 end if;
 if p_action='pause' then
 v=(p->>'paused')::boolean;if v is null then raise exception 'Choose Pause or Continue'; end if;
 insert into public.noor_institute_billing(institution_id,paused,paused_at,pause_reason) values(inst,v,case when v then now() end,left(p->>'reason',500))
 on conflict(institution_id) do update set paused=excluded.paused,paused_at=excluded.paused_at,pause_reason=excluded.pause_reason,updated_at=now();
 elsif p_action='billing' then
 if (p->>'monthly_fee') is null or (p->>'next_due') is null then raise exception 'Fee and due date required'; end if;
 insert into public.noor_institute_billing(institution_id,monthly_fee,next_due,grace_days) values(inst,(p->>'monthly_fee')::numeric,(p->>'next_due')::date,coalesce((p->>'grace_days')::int,3))
 on conflict(institution_id) do update set monthly_fee=excluded.monthly_fee,next_due=excluded.next_due,grace_days=excluded.grace_days,updated_at=now();
 elsif p_action='payment' then
 invoice_date=(p->>'due_for')::date;
 insert into public.noor_creator_payments(institution_id,amount,paid_on,due_for,reference,created_by,request_key) values(inst,(p->>'amount')::numeric,(p->>'paid_on')::date,invoice_date,left(p->>'reference',250),auth.uid(),(p->>'request_key')::uuid) on conflict(request_key) do nothing;
 get diagnostics n=row_count;if n=0 then return jsonb_build_object('saved',true,'duplicate',true);end if;
 insert into public.noor_institute_billing(institution_id,last_paid_due) values(inst,invoice_date) on conflict(institution_id) do update set last_paid_due=greatest(public.noor_institute_billing.last_paid_due,excluded.last_paid_due),updated_at=now();
 elsif p_action='features' then
 if p->>'scope' not in ('all','selected') or jsonb_typeof(p->'changes')<>'object' then raise exception 'Invalid feature scope'; end if;
 select array_agg(value::uuid) into ids from jsonb_array_elements_text(coalesce(p->'institution_ids','[]'));
 if p->>'scope'='selected' and coalesce(cardinality(ids),0)=0 then raise exception 'Select at least one institute'; end if;
 if exists(select 1 from unnest(ids) id where not exists(select 1 from public.institutions i where i.id=id)) then raise exception 'Unknown institute'; end if;
 for k in select jsonb_object_keys(p->'changes') loop
 if not exists(select 1 from public.noor_feature_catalog where feature_key=k) or jsonb_typeof(p->'changes'->k)<>'boolean' then raise exception 'Unknown feature or invalid setting'; end if;
 v=(p->'changes'->>k)::boolean;
 if p->>'scope'='all' then
 update public.noor_feature_defaults set enabled=v where feature_key=k;
 if coalesce((p->>'replace_overrides')::boolean,false) then delete from public.noor_feature_overrides where feature_key=k;end if;
 else
 insert into public.noor_feature_overrides(institution_id,feature_key,enabled) select unnest(ids),k,v on conflict(institution_id,feature_key) do update set enabled=excluded.enabled;
 end if;end loop;
 elsif p_action='broadcast' then
 if not (p->>'scope'=any(array['all','school','college','selected'])) then raise exception 'Invalid recipient scope';end if;
 if p->>'scope'='selected' then select array_agg(value::uuid) into ids from jsonb_array_elements_text(p->'institution_ids');
 else select array_agg(id) into ids from public.institutions where p->>'scope'='all' or institution_type=case when p->>'scope'='college' then 'university' else 'school' end;end if;
 if coalesce(cardinality(ids),0)=0 or exists(select 1 from unnest(ids) id where not exists(select 1 from public.institutions i where i.id=id)) then raise exception 'Choose valid institutes';end if;
 insert into public.noor_creator_broadcasts(created_by,request_key,title,body,channels,institution_ids,send_at)
 values(auth.uid(),(p->>'request_key')::uuid,btrim(p->>'title'),btrim(p->>'body'),array(select jsonb_array_elements_text(p->'channels')),ids,coalesce((p->>'send_at')::timestamptz,now())) on conflict(request_key) do nothing returning id into bid;
 if bid is null then return jsonb_build_object('saved',true,'duplicate',true);end if;
 insert into public.noor_creator_deliveries(broadcast_id,institution_id,recipient_id,published_at,email_status,retry_at)
 select bid,m.institution_id,m.user_id,case when 'in_app'=any(b.channels) then b.send_at end,
 case when 'email'=any(b.channels) then 'queued' else 'none' end,b.send_at
 from public.institution_memberships m join public.noor_creator_broadcasts b on b.id=bid
 where m.institution_id=any(ids) and m.status='active' and m.role in ('principal','university_admin') and m.user_id is not null;
 get diagnostics n=row_count;if n=0 then raise exception 'No active principals found. Message was not sent';end if;
 output=jsonb_build_object('recipients',n);
 elsif p_action='support' then
 update public.noor_creator_support set status=p->>'status',reply=left(p->>'reply',20000),updated_at=now() where id=(p->>'id')::uuid;
 elsif p_action='security' then
 v=(p->>'require_mfa')::boolean;
 if v and auth.jwt()->>'aal' is distinct from 'aal2' then raise exception 'Verify an authenticator code before requiring MFA';end if;
 update private.noor_creator_account set require_mfa=v where singleton;
 else raise exception 'Unsupported creator action';end if;
 insert into public.noor_creator_activity(actor_id,action,institution_ids,details) values(auth.uid(),p_action,ids,p-'body'-'reference');
 return jsonb_build_object('saved',true)||coalesce(output,'{}');
 end $$;
create function public.noor_creator_api(p_action text,p_payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$ select private.noor_creator_dispatch(p_action,p_payload) $$;
revoke all on function private.noor_creator_dispatch(text,jsonb),public.noor_creator_api(text,jsonb) from public,anon;
grant execute on function private.noor_creator_dispatch(text,jsonb),public.noor_creator_api(text,jsonb) to authenticated;
-- Creator can sign current private logo paths without granting tenant access to anyone else.
create policy noor_creator_logo_read on storage.objects for select to authenticated using(bucket_id='noor-school-logos' and private.is_platform_admin());

-- Principal inbox remains available while an institute is paused.
create function private.noor_creator_inbox(p_action text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
 declare inst uuid=(p->>'institution_id')::uuid;
 begin
 if auth.uid() is null or not exists(select 1 from public.institution_memberships m where m.institution_id=inst and m.user_id=auth.uid() and m.status='active' and m.role in ('principal','university_admin')) then raise exception 'Principal access required' using errcode='42501';end if;
 if p_action='read' then
 update public.noor_creator_deliveries set read_at=coalesce(read_at,now()) where id=(p->>'delivery_id')::uuid and recipient_id=auth.uid() and institution_id=inst and published_at<=now();return '{"saved":true}';
 elsif p_action='support' then
 insert into public.noor_creator_support(institution_id,created_by,subject,body) values(inst,auth.uid(),btrim(p->>'subject'),btrim(p->>'body'));return '{"saved":true}';
 end if;
 return jsonb_build_object('messages',(select coalesce(jsonb_agg(x order by x.send_at desc),'[]') from (
 select d.id,d.read_at,b.title,b.body,b.send_at from public.noor_creator_deliveries d join public.noor_creator_broadcasts b on b.id=d.broadcast_id where d.institution_id=inst and d.recipient_id=auth.uid() and d.published_at<=now() order by b.send_at desc limit 60)x),
 'support',(select coalesce(jsonb_agg(x),'[]') from(select id,subject,body,reply,status,created_at from public.noor_creator_support where institution_id=inst and created_by=auth.uid() order by created_at desc limit 30)x));
 end $$;
create function public.noor_creator_inbox(p_action text,p_payload jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.noor_creator_inbox(p_action,p_payload) $$;
revoke all on function private.noor_creator_inbox(text,jsonb),public.noor_creator_inbox(text,jsonb) from public,anon;
grant execute on function private.noor_creator_inbox(text,jsonb),public.noor_creator_inbox(text,jsonb) to authenticated;

-- Guard definer read RPCs as well as row writes. Original membership checks remain intact.
do $$ declare r record; def text; guard text; begin
 for r in select p.oid,p.proname,p.proargnames from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang where n.nspname='private' and l.lanname='plpgsql' and p.proname in ('noor_live_analytics','noor_class_performance','noor_take_ai_budget','noor_quiz_review_data','noor_quiz_result_key','noor_publish_test','noor_test_clock','noor_submit_quiz') loop
 if 'p_institution'=any(r.proargnames) then
 guard=format('if auth.uid() is not null and not private.noor_feature_enabled(p_institution,%L) then raise exception ''Feature access disabled by NOOR'' using errcode=''42501''; end if;',case when r.proname='noor_live_analytics' then 'analytics' when r.proname='noor_class_performance' then 'report_cards' when r.proname='noor_take_ai_budget' then 'ai_assistant' else 'platform' end);
 else
 guard='if auth.uid() is not null and not exists(select 1 from public.noor_weekly_quizzes q where q.id=p_quiz and private.noor_feature_enabled(q.institution_id,case q.assessment_kind when ''monthly'' then ''monthly_tests'' when ''exam'' then ''exams'' else ''weekly_tests'' end)) then raise exception ''Test access disabled by NOOR'' using errcode=''42501''; end if;';
 end if;
 def=pg_get_functiondef(r.oid);def=regexp_replace(def,'\mBEGIN\M','BEGIN '||guard,'i');execute def;
 end loop;
end $$;

-- Background delivery is service-only; no browser can claim or send another principal's mail.
create function private.noor_creator_claim_mail() returns jsonb language plpgsql security definer set search_path='' as $$
 declare claimed uuid[];
 begin
 with due as(select d.id from public.noor_creator_deliveries d join public.noor_creator_broadcasts b on b.id=d.broadcast_id
 join private.noor_creator_account c on c.singleton and c.user_id=b.created_by
 join auth.users owner_account on owner_account.id=c.user_id and lower(owner_account.email)=c.email and owner_account.email_confirmed_at is not null
 where d.email_status in ('queued','sending') and d.retry_at<=now() and d.attempts<4 and b.send_at<=now()
 and exists(select 1 from public.platform_roles pr where pr.user_id=c.user_id and pr.role='platform_owner')
 order by d.retry_at limit 30 for update of d skip locked)
  , updated as(update public.noor_creator_deliveries d set email_status='sending',attempts=attempts+1,retry_at=now()+interval '5 minutes' from due where d.id=due.id returning d.id) select array_agg(id) into claimed from updated;
 return (select coalesce(jsonb_agg(x),'[]') from (
 select d.id,d.attempts,b.title,b.body,u.email,
 exists(select 1 from public.institution_memberships m where m.institution_id=d.institution_id and m.user_id=d.recipient_id and m.status='active' and m.role in ('principal','university_admin')) and u.email_confirmed_at is not null eligible
 from public.noor_creator_deliveries d join public.noor_creator_broadcasts b on b.id=d.broadcast_id join auth.users u on u.id=d.recipient_id
 where d.id=any(claimed)) x);
 end $$;
-- Public wrapper restricted to trusted service role only.
create function public.noor_creator_claim_mail() returns jsonb language sql security invoker set search_path='' as $$ select private.noor_creator_claim_mail() $$;
revoke all on function private.noor_creator_claim_mail(),public.noor_creator_claim_mail() from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.noor_creator_claim_mail(),public.noor_creator_claim_mail() to service_role;
