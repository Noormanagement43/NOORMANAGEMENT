-- NOOR AI Task 6 follow-up: complete invitation profile fields and correct schedule audit payload.
create or replace function private.noor_accept_school_invitation(p_token text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid; v_email text; v_verified timestamptz; v_name text; v_username text; v_mobile text; v_inv public.school_invitations%rowtype;
begin
 v_user:=auth.uid();
 if v_user is null or length(coalesce(p_token,''))<24 or length(p_token)>256 then raise exception 'Valid sign-in and invitation token are required' using errcode='42501'; end if;
 select email,email_confirmed_at,coalesce(raw_user_meta_data->>'full_name','School member'),
  nullif(trim(coalesce(raw_user_meta_data->>'username','')),''),nullif(trim(coalesce(raw_user_meta_data->>'mobile_number','')),'')
 into v_email,v_verified,v_name,v_username,v_mobile from auth.users where id=v_user;
 if v_verified is null or v_email is null then raise exception 'Verify your email address before accepting this invitation' using errcode='42501'; end if;
 select * into v_inv from public.school_invitations where token_hash=encode(digest(p_token,'sha256'),'hex') for update;
 if not found or v_inv.revoked_at is not null or v_inv.expires_at<=now() or v_inv.used_count>=v_inv.max_uses then raise exception 'Invitation is invalid, expired, revoked or already used' using errcode='42501'; end if;
 if v_inv.invited_email is not null and lower(v_inv.invited_email)<>lower(v_email) then raise exception 'This invitation belongs to a different email address' using errcode='42501'; end if;
 if v_inv.role='owner' then raise exception 'Owner accounts are created through the verified new-school flow' using errcode='42501'; end if;
 if v_inv.role in ('principal','manager') and not exists(select 1 from public.profiles p where p.id=v_inv.created_by and (p.role='creator' or (p.role='owner' and exists(select 1 from public.school_memberships m where m.school_id=v_inv.school_id and m.user_id=p.id and m.role='owner' and m.status='active')))) then
  raise exception 'Only the platform creator or active School Owner can appoint a Principal or Manager' using errcode='42501'; end if;
 if exists(select 1 from public.profiles p where p.id=v_user and p.school_id is not null and p.school_id<>v_inv.school_id) then raise exception 'This account already belongs to another primary school. Multi-school profile switching is not configured.' using errcode='42501'; end if;
 if v_username is not null and (length(v_username)<3 or length(v_username)>40 or v_username !~ '^[A-Za-z0-9._-]+$') then raise exception 'Choose a valid username: 3–40 letters, numbers, dot, underscore or dash' using errcode='22023'; end if;
 if v_username is null then
  v_username:=left(lower(regexp_replace(split_part(v_email,'@',1),'[^a-z0-9._-]','','g')),26);
  if length(v_username)<3 then v_username:='member'; end if; v_username:=v_username||'-'||lower(substr(encode(gen_random_bytes(3),'hex'),1,6));
 end if;
 if exists(select 1 from public.school_memberships m where m.school_id=v_inv.school_id and lower(m.username)=lower(v_username) and m.user_id<>v_user) then raise exception 'This username is already taken in this school. Use a different username.' using errcode='23505'; end if;
 v_name:=left(coalesce(nullif(trim(v_name),''),'School member'),120);
 perform set_config('noor.accepting_invitation','on',true);
 update public.school_invitations set used_count=used_count+1 where id=v_inv.id;
 perform set_config('noor.allow_profile_admin_change','on',true);
 insert into public.profiles(id,email,full_name,role,status,school_id,school_name_submitted,mobile_number,updated_at)
 values(v_user,v_email,v_name,v_inv.role,'active',v_inv.school_id,(select name from public.schools where id=v_inv.school_id),v_mobile,now())
 on conflict(id) do update set email=excluded.email,full_name=coalesce(nullif(public.profiles.full_name,''),excluded.full_name),
  role=excluded.role,status='active',school_id=excluded.school_id,school_name_submitted=excluded.school_name_submitted,
  mobile_number=coalesce(excluded.mobile_number,public.profiles.mobile_number),updated_at=now();
 insert into public.school_memberships(school_id,user_id,role,status,username,joined_at)
 values(v_inv.school_id,v_user,v_inv.role,'active',v_username,now())
 on conflict(school_id,user_id) do update set role=excluded.role,status='active',username=excluded.username,removed_at=null,removed_by=null,removal_reason=null,joined_at=now(),updated_at=now();
 insert into public.administrative_audit_logs(school_id,actor_id,target_user_id,action,metadata)
 values(v_inv.school_id,v_user,v_user,'school_invitation_accepted',jsonb_build_object('invitation_id',v_inv.id,'role',v_inv.role,'username',v_username));
 return jsonb_build_object('school_id',v_inv.school_id,'role',v_inv.role,'school_name',(select name from public.schools where id=v_inv.school_id),'username',v_username);
end;
$$;

create or replace function private.noor_complete_teaching_session(p_schedule_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare v_actor uuid; v_school uuid; v_teacher uuid; v_status text; v_topic text;
begin
 v_actor:=auth.uid(); if v_actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select school_id,teacher_id,status,topic into v_school,v_teacher,v_status,v_topic from public.teacher_schedule_entries where id=p_schedule_id for update;
 if v_school is null then raise exception 'Schedule entry not found' using errcode='P0002'; end if;
 if v_status<>'scheduled' then raise exception 'Only scheduled sessions can be completed' using errcode='23514'; end if;
 if not (v_teacher=v_actor and private.noor_active_school_access(v_school)) and not private.noor_can_school_permission(v_school,'manage_schedules') then raise exception 'You cannot complete this schedule entry' using errcode='42501'; end if;
 update public.teacher_schedule_entries set status='completed',completed_by=v_actor,completed_at=now(),updated_at=now() where id=p_schedule_id;
 insert into public.administrative_audit_logs(school_id,actor_id,target_user_id,target_record_id,action,metadata)
 values(v_school,v_actor,v_teacher,p_schedule_id,'teaching_session_completed',jsonb_build_object('schedule_id',p_schedule_id,'topic',v_topic));
end;
$$;
create unique index if not exists schools_active_name_lower_uq on public.schools(lower(trim(name))) where is_active=true;
