create or replace function private.noor_period_teacher_names(p_institution uuid)
returns table(period_id uuid,teacher_name text)
language plpgsql stable security definer set search_path=''
as $function$
begin
 if auth.uid() is null or not private.is_active_member(p_institution) then raise exception 'Active school membership required' using errcode='42501'; end if;
 return query select t.id,p.full_name from public.teacher_timetable_periods t
 join public.institution_memberships m on m.id=t.teacher_membership_id and m.institution_id=t.institution_id
 join public.profiles p on p.id=m.user_id
 where t.institution_id=p_institution and m.status='active' and (
 private.can_manage_academics(p_institution) or m.user_id=auth.uid() or private.noor_group_access(p_institution,t.academic_group_id,false));
end $function$;
revoke all on function private.noor_period_teacher_names(uuid) from public,anon;
grant execute on function private.noor_period_teacher_names(uuid) to authenticated;
create or replace function public.noor_period_teacher_names(p_institution uuid)
returns table(period_id uuid,teacher_name text)
language sql stable security invoker set search_path=''
as $function$ select * from private.noor_period_teacher_names(p_institution); $function$;
revoke all on function public.noor_period_teacher_names(uuid) from public,anon;
grant execute on function public.noor_period_teacher_names(uuid) to authenticated;
notify pgrst,'reload schema';