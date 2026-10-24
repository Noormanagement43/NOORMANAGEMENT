-- NOOR AI: centrally enforce active membership in school authorization helpers.
create or replace function private.noor_active_school_access(p_school_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.status='active'
   and (p.role='creator' or (p.school_id=p_school_id and (
     not exists(select 1 from public.school_memberships m where m.school_id=p_school_id and m.user_id=p.id)
     or exists(select 1 from public.school_memberships m where m.school_id=p_school_id and m.user_id=p.id and m.role=p.role and m.status='active')
   ))));
$$;
revoke all on function private.noor_active_school_access(uuid) from public,anon;
grant execute on function private.noor_active_school_access(uuid) to authenticated;

create or replace function private.has_school_role(p_school_id uuid,p_roles text[])
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.status='active'
   and (p.role='creator' or (p.school_id=p_school_id and p.role=any(p_roles) and (
     not exists(select 1 from public.school_memberships m where m.school_id=p_school_id and m.user_id=p.id)
     or exists(select 1 from public.school_memberships m where m.school_id=p_school_id and m.user_id=p.id and m.role=p.role and m.status='active')
   ))));
$$;

create or replace function private.noor_can_school_permission(p_school_id uuid,p_permission_key text)
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.status='active' and (
   p.role='creator' or (p.school_id=p_school_id and (
     not exists(select 1 from public.school_memberships m where m.school_id=p_school_id and m.user_id=p.id)
     or exists(select 1 from public.school_memberships m where m.school_id=p_school_id and m.user_id=p.id and m.role=p.role and m.status='active')
   ) and (p.role in ('owner','principal') or (p.role='manager' and exists(
     select 1 from public.role_permissions rp where rp.school_id=p_school_id and rp.role='manager'
       and rp.permission_key=p_permission_key and rp.is_allowed=true
   ))))
 ));
$$;

create or replace function private.noor_is_assigned_teacher(p_school_id uuid,p_class_id uuid,p_section_id uuid,p_subject_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(select 1 from public.profiles p join public.teacher_assignments ta on ta.school_id=p_school_id and ta.teacher_id=p.id
   where p.id=(select auth.uid()) and p.status='active' and p.role='teacher' and p.school_id=p_school_id and ta.is_active
   and ta.class_id=p_class_id and (ta.section_id is null or ta.section_id is not distinct from p_section_id)
   and (ta.subject_id is null or ta.subject_id is not distinct from p_subject_id)
   and private.noor_active_school_access(p_school_id));
$$;
revoke all on function private.has_school_role(uuid,text[]) from public,anon;
revoke all on function private.noor_can_school_permission(uuid,text) from public,anon;
revoke all on function private.noor_is_assigned_teacher(uuid,uuid,uuid,uuid) from public,anon;
grant execute on function private.has_school_role(uuid,text[]) to authenticated;
grant execute on function private.noor_can_school_permission(uuid,text) to authenticated;
grant execute on function private.noor_is_assigned_teacher(uuid,uuid,uuid,uuid) to authenticated;
