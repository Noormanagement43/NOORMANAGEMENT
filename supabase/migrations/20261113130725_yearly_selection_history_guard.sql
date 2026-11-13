-- Prevent replaying old signup metadata after rollover.
create or replace function public.noor_class_update_status(p_institution uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare w public.noor_class_update_windows; m public.institution_memberships; chosen boolean; assigned boolean;
begin
 select * into m from public.institution_memberships where institution_id=p_institution and user_id=auth.uid() and status='active';
 if m.id is null or not private.is_active_member(p_institution) then raise exception 'Active school membership required' using errcode='42501'; end if;
 select * into w from public.noor_class_update_windows where institution_id=p_institution;
 if w.institution_id is null then
  insert into public.noor_class_update_windows(institution_id,start_year) select p_institution,extract(year from timezone(i.timezone,now()))::int-case when extract(month from timezone(i.timezone,now()))<6 then 1 else 0 end from public.institutions i where i.id=p_institution on conflict do nothing;
  select * into w from public.noor_class_update_windows where institution_id=p_institution;
 end if;
 chosen=exists(select 1 from public.noor_student_year_choices where membership_id=m.id and start_year=w.start_year);
 assigned=exists(select 1 from public.academic_group_memberships gm join public.academic_groups g on g.id=gm.group_id where gm.membership_id=m.id and gm.status='active' and g.group_type in('class','section'));
 return jsonb_build_object('start_year',w.start_year,'is_open',w.is_open,'selected',chosen,'has_history',exists(select 1 from public.noor_student_year_choices where membership_id=m.id),'can_select',case when m.role in('student','university_student') then not chosen and (w.is_open or not exists(select 1 from public.noor_student_year_choices where membership_id=m.id)) when m.role in('teacher','faculty') then not assigned else false end);
end $$;

create or replace function public.noor_set_class_update_window(p_institution uuid,p_start_year integer,p_open boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare w public.noor_class_update_windows; r record; today date;
begin
 if auth.uid() is null or not private.has_institution_role(p_institution,array['principal','school_admin','university_admin']) then raise exception 'Principal access required' using errcode='42501'; end if;
 perform public.noor_class_update_status(p_institution);
 select * into w from public.noor_class_update_windows where institution_id=p_institution for update;
 select timezone(timezone,now())::date into today from public.institutions where id=p_institution;
 if p_open is null or p_start_year is null or p_start_year<w.start_year or p_start_year>w.start_year+1 or p_start_year>extract(year from today)::int or (p_start_year>w.start_year and today<make_date(p_start_year,6,1)) then raise exception 'Choose the current session or the next session from its June start date' using errcode='22023'; end if;
 if p_start_year>w.start_year then
  for r in select membership_id from public.noor_student_year_choices where institution_id=p_institution and start_year=w.start_year loop
   perform private.noor_archive_student_year(p_institution,r.membership_id,w.start_year);
  end loop;
  update public.academic_years set is_current=false where institution_id=p_institution and is_current;
  -- Old class access stops while students select their new session placement.
  update public.academic_group_memberships gm set status='inactive' from public.institution_memberships m where gm.membership_id=m.id and gm.institution_id=p_institution and m.role in('student','university_student') and gm.group_role='student' and gm.status='active';
 end if;
 update public.academic_years set is_current=false where institution_id=p_institution and is_current;
 insert into public.academic_years(institution_id,label,start_date,end_date,is_current) values(p_institution,p_start_year::text||'-'||(p_start_year+1)::text,make_date(p_start_year,6,1),make_date(p_start_year+1,5,31),true)
 on conflict(institution_id,label) do update set is_current=true;
 update public.noor_class_update_windows set start_year=p_start_year,is_open=p_open,updated_at=now() where institution_id=p_institution;
 insert into public.noor_audit_events(institution_id,actor_id,action,metadata) values(p_institution,auth.uid(),'student.class_update_window',jsonb_build_object('start_year',p_start_year,'open',p_open));
 return public.noor_class_update_status(p_institution);
end $$;

