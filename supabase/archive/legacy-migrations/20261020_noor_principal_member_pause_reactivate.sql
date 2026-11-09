-- NOOR: Principal-only reversible teacher/student school access.
-- A pause preserves records and revokes all school-scoped access through active membership RLS.
create or replace function public.noor_set_member_access(
  p_user_id uuid, p_action text, p_reason text default null
) returns jsonb
language plpgsql security definer set search_path=''
as $fn$
declare
  v_actor uuid := auth.uid();
  v_school uuid;
  v_member_id uuid;
  v_role text;
  v_old_status text;
  v_target_status text;
  v_profile_status text;
  v_authorised boolean;
begin
  if v_actor is null then
    raise exception 'Principal sign-in required' using errcode='42501';
  end if;
  if p_action not in ('pause','reactivate') then
    raise exception 'Invalid access action' using errcode='22023';
  end if;
  select m.id,m.school_id,m.role,m.status
    into v_member_id,v_school,v_role,v_old_status
    from public.school_memberships m
    join public.profiles p on p.id=m.user_id and p.school_id=m.school_id and p.role=m.role
   where m.user_id=p_user_id and m.role in ('teacher','student')
   for update of m;
  if v_member_id is null then
    raise exception 'Teacher or student membership not found' using errcode='P0002';
  end if;
  if v_actor=p_user_id then
    raise exception 'Self-modification is not allowed' using errcode='42501';
  end if;
  select private.is_creator() or exists (
    select 1 from public.profiles a
    join public.school_memberships am on am.user_id=a.id and am.school_id=a.school_id
      and am.role=a.role and am.status='active'
    join public.schools s on s.id=a.school_id
    where a.id=v_actor and a.school_id=v_school and a.status='active'
      and a.role in ('owner','principal')
      and s.is_active and s.account_status='active' and s.verification_status='verified'
  ) into v_authorised;
  if not coalesce(v_authorised,false) then
    raise exception 'Only this school Principal may control member access' using errcode='42501';
  end if;
  if v_old_status not in ('active','suspended') then
    raise exception 'Removed or transferred members cannot use Pause/Reactivate' using errcode='42501';
  end if;
  v_target_status := case when p_action='pause' then 'suspended' else 'active' end;
  v_profile_status := case when p_action='pause' then 'inactive' else 'active' end;
  update public.school_memberships set status=v_target_status,updated_at=now(),
    removed_at=case when p_action='pause' then now() else null end,
    removed_by=case when p_action='pause' then v_actor else null end,
    removal_reason=case when p_action='pause' then left(nullif(trim(coalesce(p_reason,'')),''),300) else null end
  where id=v_member_id;
  perform set_config('noor.member_admin_change','on',true);
  perform set_config('noor.allow_profile_admin_change','on',true);
  update public.profiles set status=v_profile_status,updated_at=now() where id=p_user_id;
  insert into public.administrative_audit_logs
    (school_id,actor_id,target_user_id,action,reason,metadata)
  values (v_school,v_actor,p_user_id,
    case when p_action='pause' then 'school_member_paused' else 'school_member_reactivated' end,
    left(nullif(trim(coalesce(p_reason,'')),''),300),
    jsonb_build_object('membership_id',v_member_id,'role',v_role,
      'previous_status',v_old_status,'new_status',v_target_status));
  return jsonb_build_object('user_id',p_user_id,'role',v_role,
     'membership_status',v_target_status,'profile_status',v_profile_status);
end;
$fn$;
revoke all on function public.noor_set_member_access(uuid,text,text) from public,anon;
grant execute on function public.noor_set_member_access(uuid,text,text) to authenticated;

-- Prevent a paused or removed member from bypassing the Principal with their old join code.
create or replace function private.noor_guard_member_status_transitions()
returns trigger language plpgsql security definer set search_path=''
as $fn$
begin
  if new.status is distinct from old.status
     and old.status in ('suspended','removed','transferred')
     and new.status='active'
     and auth.uid()=old.user_id then
    raise exception 'School access was paused or removed. Only your Principal can reactivate it.' using errcode='42501';
  end if;
  if new.status is distinct from old.status and old.role in ('teacher','student')
     and new.status in ('active','suspended')
     and auth.uid() is not null
     and current_setting('noor.accepting_invitation',true) is distinct from 'on'
     and not private.is_creator()
     and not exists (
       select 1 from public.profiles a
       join public.school_memberships am on am.user_id=a.id
         and am.school_id=old.school_id and am.role=a.role and am.status='active'
       where a.id=auth.uid() and a.status='active'
         and a.role in ('owner','principal') and a.school_id=old.school_id
     ) then
     raise exception 'Principal permission required to change member access.' using errcode='42501';
  end if;
  return new;
end;
$fn$;
drop trigger if exists noor_guard_member_status_transitions on public.school_memberships;
create trigger noor_guard_member_status_transitions
before update of status on public.school_memberships
for each row execute function private.noor_guard_member_status_transitions();

-- An authenticated user must never reactivate their own suspended profile via a join-code RPC.
-- For existing members, privileged status changes must pass through noor_set_member_access.
create or replace function private.noor_guard_member_profile_status()
returns trigger language plpgsql security definer set search_path=''
as $fn$
begin
  if old.role in ('teacher','student')
     and new.status is distinct from old.status
     and old.status in ('active','inactive')
     and auth.uid() is not null
     and current_setting('noor.member_admin_change',true) is distinct from 'on' then
    raise exception 'Use the Principal access controls to pause or reactivate members.' using errcode='42501';
  end if;
  return new;
end;
$fn$;
drop trigger if exists noor_guard_member_profile_status on public.profiles;
create trigger noor_guard_member_profile_status
before update of status on public.profiles
for each row execute function private.noor_guard_member_profile_status();
