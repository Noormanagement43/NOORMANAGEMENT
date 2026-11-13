-- Private, role-derived support requests. Existing principal requests are preserved.
alter table public.noor_creator_support
 add column category text not null default 'problem' check(category in ('problem','suggestion','idea')),
 add column sender_role text not null default 'principal' check(sender_role in ('principal','teacher','student','parent')),
 add column sender_name text,
 add column sender_email text,
 add column request_key uuid;
update public.noor_creator_support t set
 sender_name=pr.full_name,sender_email=u.email,
 sender_role=case when m.role in ('teacher','faculty','staff') then 'teacher' when m.role in ('student','university_student') then 'student' when m.role='parent' then 'parent' else 'principal' end
 from public.institution_memberships m join public.profiles pr on pr.id=m.user_id join auth.users u on u.id=m.user_id
 where t.institution_id=m.institution_id and t.created_by=m.user_id;
create unique index noor_help_request_key on public.noor_creator_support(created_by,request_key) where request_key is not null;
create index noor_help_sender_history on public.noor_creator_support(created_by,institution_id,created_at desc,id desc);
create index noor_help_role_queue on public.noor_creator_support(sender_role,status,created_at desc,id desc);
create index noor_help_open on public.noor_creator_support(created_at desc) where status='open';

create function private.noor_help_summary() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('total',count(*),'open',count(*) filter(where status='open'),
 'principal',count(*) filter(where sender_role='principal' and status='open'),
 'teacher',count(*) filter(where sender_role='teacher' and status='open'),
 'student',count(*) filter(where sender_role='student' and status='open'),
 'parent',count(*) filter(where sender_role='parent' and status='open'),
 'version',coalesce(max(updated_at)::text,'')||':'||count(*)::text)
 from public.noor_creator_support
$$;
revoke all on function private.noor_help_summary() from public,anon,authenticated;

create function private.noor_help_workspace(p_action text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid=auth.uid(); inst uuid; membership_role text; kind text; subject_line text; message_body text;
 ticket public.noor_creator_support%rowtype; request_id uuid; role_filter text; status_filter text; page_offset integer; output jsonb; reply_body text;
begin
 if uid is null then raise exception 'Sign in to send or view help requests' using errcode='42501';end if;
 if p is null or jsonb_typeof(p)<>'object' then raise exception 'Invalid help request';end if;
 if p_action in ('creator-list','creator-summary','creator-reply') then
  if not private.is_platform_admin() then raise exception 'Authorized NOOR creator account required' using errcode='42501';end if;
  if p_action='creator-summary' then return private.noor_help_summary();end if;
  if p_action='creator-reply' then
   reply_body=btrim(coalesce(p->>'reply',''));status_filter=p->>'status';
   if length(reply_body)>20000 or status_filter not in ('open','resolved') or status_filter is null then raise exception 'Choose a valid status and reply';end if;
   update public.noor_creator_support set reply=nullif(reply_body,''),status=status_filter,updated_at=clock_timestamp() where id=(p->>'id')::uuid returning * into ticket;
   if not found then raise exception 'Help request not found';end if;
   insert into public.noor_creator_activity(actor_id,action,institution_ids,details) values(uid,'support',array[ticket.institution_id],jsonb_build_object('id',ticket.id,'status',ticket.status));
   return jsonb_build_object('saved',true,'id',ticket.id);
  end if;
  role_filter=coalesce(p->>'role','all');status_filter=coalesce(p->>'status','all');page_offset=coalesce((p->>'offset')::integer,0);
  if role_filter not in ('all','principal','teacher','student','parent') or status_filter not in ('all','open','resolved') or page_offset<0 or page_offset>1000000 then raise exception 'Invalid support filter';end if;
  select jsonb_build_object('items',coalesce(jsonb_agg(x order by x.created_at desc,x.id desc),'[]')) into output from (
   select t.*,i.name school_name from public.noor_creator_support t join public.institutions i on i.id=t.institution_id
   where (role_filter='all' or t.sender_role=role_filter) and (status_filter='all' or t.status=status_filter)
   order by t.created_at desc,t.id desc limit 30 offset page_offset
  )x;
  return output||jsonb_build_object('summary',private.noor_help_summary(),'total',(select count(*) from public.noor_creator_support t where (role_filter='all' or t.sender_role=role_filter) and (status_filter='all' or t.status=status_filter)));
 end if;
 inst=(p->>'institution_id')::uuid;
 select m.role into membership_role from public.institution_memberships m where m.institution_id=inst and m.user_id=uid and m.status='active';
 if not found then raise exception 'Active school membership required' using errcode='42501';end if;
 if p_action='mine' then
  page_offset=coalesce((p->>'offset')::integer,0);if page_offset<0 or page_offset>1000000 then raise exception 'Invalid page';end if;
  return jsonb_build_object('items',(select coalesce(jsonb_agg(x order by x.created_at desc,x.id desc),'[]') from (
   select id,subject,body,category,status,reply,created_at,updated_at from public.noor_creator_support where institution_id=inst and created_by=uid order by created_at desc,id desc limit 20 offset page_offset)x),
   'total',(select count(*) from public.noor_creator_support where institution_id=inst and created_by=uid));
 elsif p_action='submit' then
  kind=coalesce(p->>'category','problem');subject_line=btrim(coalesce(p->>'subject',''));message_body=btrim(coalesce(p->>'body',''));request_id=(p->>'request_key')::uuid;
  if kind not in ('problem','suggestion','idea') or length(subject_line) not between 1 and 180 or length(message_body) not between 1 and 20000 then raise exception 'Enter a subject and message within the allowed length';end if;
  -- Serialize retries/rate checks per account. Roles and contact identity come from the database.
  perform pg_advisory_xact_lock(hashtextextended(uid::text||':noor-help',0));
  if request_id is not null then
   select * into ticket from public.noor_creator_support where created_by=uid and request_key=request_id;
   if found then
    if ticket.institution_id<>inst or ticket.subject<>subject_line or ticket.body<>message_body or ticket.category<>kind then raise exception 'This request reference was already used';end if;
    return jsonb_build_object('saved',true,'id',ticket.id,'duplicate',true);
   end if;
  end if;
  if (select count(*) from public.noor_creator_support where created_by=uid and created_at>now()-interval '10 minutes')>=5 then raise exception 'Please wait before sending another request. Your earlier messages are already with NOOR.';end if;
  insert into public.noor_creator_support(institution_id,created_by,subject,body,category,sender_role,sender_name,sender_email,request_key)
   select inst,uid,subject_line,message_body,kind,
    case when membership_role in ('teacher','faculty','staff') then 'teacher' when membership_role in ('student','university_student') then 'student' when membership_role='parent' then 'parent' else 'principal' end,
    pr.full_name,u.email,request_id from auth.users u left join public.profiles pr on pr.id=u.id where u.id=uid returning * into ticket;
  return jsonb_build_object('saved',true,'id',ticket.id);
 end if;
 raise exception 'Unsupported help action';
end $$;
revoke all on function private.noor_help_workspace(text,jsonb) from public,anon;
grant execute on function private.noor_help_workspace(text,jsonb) to authenticated;
create function public.noor_help_workspace(p_action text,p_payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$ select private.noor_help_workspace(p_action,p_payload) $$;
revoke all on function public.noor_help_workspace(text,jsonb) from public,anon;
grant execute on function public.noor_help_workspace(text,jsonb) to authenticated;

-- Older support buttons use the same validated request workflow and identity snapshots.
do $patch$ declare definition text;begin
 select pg_get_functiondef('private.noor_creator_inbox(text,jsonb)'::regprocedure) into definition;
 definition=regexp_replace(definition,'\mBEGIN\M',$entry$BEGIN
 if p_action='support' then return private.noor_help_workspace('submit',p);end if;
 $entry$,'i');
 execute definition;
end $patch$;
