-- Profile-based yearly class updates. Existing academic records are never deleted.
create table public.noor_class_update_windows (
 institution_id uuid primary key references public.institutions(id),
 start_year integer not null check(start_year between 2000 and 2200),
 is_open boolean not null default false,
 updated_at timestamptz not null default now()
);
create table public.noor_student_year_choices (
 institution_id uuid not null references public.institutions(id),
 membership_id uuid not null,
 start_year integer not null,
 class_id uuid not null,
 section_id uuid,
 saved_at timestamptz not null default now(),
 primary key(membership_id,start_year),
 foreign key(membership_id,institution_id) references public.institution_memberships(id,institution_id),
 foreign key(class_id,institution_id) references public.academic_groups(id,institution_id),
 foreign key(section_id,institution_id) references public.academic_groups(id,institution_id)
);
create table public.noor_annual_archives (
 institution_id uuid not null references public.institutions(id),
 membership_id uuid not null,
 start_year integer not null,
 report jsonb not null,
 archived_at timestamptz not null default now(),
 primary key(membership_id,start_year),
 foreign key(membership_id,institution_id) references public.institution_memberships(id,institution_id)
);
create index noor_year_choices_tenant on public.noor_student_year_choices(institution_id,start_year);
create index noor_annual_archives_tenant on public.noor_annual_archives(institution_id,start_year);
alter table public.noor_class_update_windows enable row level security;
alter table public.noor_student_year_choices enable row level security;
alter table public.noor_annual_archives enable row level security;
revoke all on public.noor_class_update_windows,public.noor_student_year_choices,public.noor_annual_archives from public,anon,authenticated;
grant select on public.noor_class_update_windows,public.noor_student_year_choices,public.noor_annual_archives to authenticated;
create policy class_window_read on public.noor_class_update_windows for select to authenticated using(private.is_active_member(institution_id));
create policy year_choice_read on public.noor_student_year_choices for select to authenticated using(private.is_my_membership(membership_id) or private.can_manage_academics(institution_id));
create policy annual_archive_read on public.noor_annual_archives for select to authenticated using(private.is_my_membership(membership_id) or private.can_manage_academics(institution_id) or exists(
 select 1 from public.academic_groups g where g.institution_id=noor_annual_archives.institution_id and g.id=(noor_annual_archives.report->>'section_id')::uuid
 and g.homeroom_teacher_membership_id in(select m.id from public.institution_memberships m where m.user_id=auth.uid() and m.status='active' and m.institution_id=g.institution_id and m.role in('teacher','faculty'))));
-- Existing members start locked. Their existing saved placements remain unchanged.
insert into public.noor_class_update_windows(institution_id,start_year)
 select i.id,coalesce((select extract(year from y.start_date)::int from public.academic_years y where y.institution_id=i.id and y.is_current),
 extract(year from timezone(i.timezone,now()))::int-case when extract(month from timezone(i.timezone,now()))<6 then 1 else 0 end) from public.institutions i;
insert into public.noor_student_year_choices(institution_id,membership_id,start_year,class_id,section_id)
 select m.institution_id,m.id,w.start_year,coalesce(g.parent_group_id,g.id),case when g.group_type='section' then g.id end
 from public.institution_memberships m join public.noor_class_update_windows w on w.institution_id=m.institution_id
 join lateral(select a.* from public.academic_group_memberships gm join public.academic_groups a on a.id=gm.group_id and a.institution_id=gm.institution_id
 where gm.membership_id=m.id and gm.institution_id=m.institution_id and gm.status='active' and gm.group_role='student' and a.group_type in('class','section') order by (a.group_type='section') desc limit 1) g on true
 where m.role in('student','university_student');

-- Internal archive builder has no client EXECUTE privilege. Store dated marks and actual daily attendance, without assuming unmarked=absent.
create function private.noor_archive_student_year(p_inst uuid,p_member uuid,p_year integer) returns void language sql security definer set search_path='' as $$
 insert into public.noor_annual_archives(institution_id,membership_id,start_year,report)
 select p_inst,p_member,p_year,jsonb_build_object(
 'student_name',p.full_name,'school_name',i.name,'roll_number',d.roll_number,
 'year_label',p_year::text||'–'||(p_year+1)::text,'start_date',make_date(p_year,6,1),'end_date',make_date(p_year+1,5,31),
 'class_id',c.class_id,'section_id',c.section_id,'class_name',cg.name,'section_name',sg.name,
 'marks',coalesce((select jsonb_agg(jsonb_build_object('subject',r.subject_name,'exam',r.assessment_title,'kind',r.assessment_kind,'date',r.assessed_on,'marks',r.marks,'max_marks',r.max_marks,'feedback',r.feedback) order by r.assessed_on,r.subject_name) from public.noor_assessment_results r
 where r.institution_id=p_inst and r.student_membership_id=p_member and r.assessed_on between make_date(p_year,6,1) and make_date(p_year+1,5,31)),'[]'::jsonb),
 'attendance',coalesce((select jsonb_agg(jsonb_build_object('date',a.attendance_day,'status',a.attendance_status) order by a.attendance_day) from (
 select distinct on((s.starts_at at time zone i.timezone)::date) (s.starts_at at time zone i.timezone)::date as attendance_day,ar.attendance_status
 from public.attendance_records ar join public.class_sessions s on s.id=ar.session_id and s.institution_id=ar.institution_id
 where ar.institution_id=p_inst and ar.student_membership_id=p_member and s.title='Daily class attendance' and s.session_status<>'cancelled'
 and (s.starts_at at time zone i.timezone)::date between make_date(p_year,6,1) and make_date(p_year+1,5,31)
 order by (s.starts_at at time zone i.timezone)::date,ar.marked_at desc) a),'[]'::jsonb),
 'report_settings',(select to_jsonb(rs) from public.noor_report_settings rs where rs.institution_id=p_inst))
 from public.institution_memberships m join public.profiles p on p.id=m.user_id join public.institutions i on i.id=m.institution_id
 join public.noor_student_year_choices c on c.membership_id=m.id and c.start_year=p_year
 left join public.academic_groups cg on cg.id=c.class_id left join public.academic_groups sg on sg.id=c.section_id
 left join public.noor_student_display_preferences d on d.membership_id=m.id
 where m.id=p_member and m.institution_id=p_inst on conflict(membership_id,start_year) do nothing;
$$;
revoke all on function private.noor_archive_student_year(uuid,uuid,integer) from public,anon,authenticated;

create function public.noor_class_update_status(p_institution uuid) returns jsonb language plpgsql security definer set search_path='' as $$
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
 return jsonb_build_object('start_year',w.start_year,'is_open',w.is_open,'selected',chosen,'can_select',case when m.role in('student','university_student') then not chosen and (w.is_open or not exists(select 1 from public.noor_student_year_choices where membership_id=m.id)) when m.role in('teacher','faculty') then not assigned else false end);
end $$;

create function public.noor_set_class_update_window(p_institution uuid,p_start_year integer,p_open boolean) returns jsonb language plpgsql security definer set search_path='' as $$
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
 insert into public.academic_years(institution_id,label,start_date,end_date,is_current) values(p_institution,p_start_year::text||'-'||(p_start_year+1)::text,make_date(p_start_year,6,1),make_date(p_start_year+1,5,31),true)
 on conflict(institution_id,label) do update set is_current=true;
 update public.noor_class_update_windows set start_year=p_start_year,is_open=p_open,updated_at=now() where institution_id=p_institution;
 insert into public.noor_audit_events(institution_id,actor_id,action,metadata) values(p_institution,auth.uid(),'student.class_update_window',jsonb_build_object('start_year',p_start_year,'open',p_open));
 return public.noor_class_update_status(p_institution);
end $$;

create or replace function private.noor_select_student_section(p_institution uuid,p_class uuid,p_section uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare m uuid; w public.noor_class_update_windows; old public.noor_student_year_choices;
begin
 if auth.uid() is null or not private.is_active_member(p_institution) then raise exception 'Active student membership required' using errcode='42501'; end if;
 -- Same lock order as principal rollover: window, then student membership.
 perform public.noor_class_update_status(p_institution);
 select * into w from public.noor_class_update_windows where institution_id=p_institution for update;
 select id into m from public.institution_memberships where institution_id=p_institution and user_id=auth.uid() and status='active' and role in('student','university_student') for update;
 if m is null then raise exception 'Active student membership required' using errcode='42501'; end if;
 if not private.noor_consume_limit('select_student_section',10) then raise exception 'Too many requests' using errcode='54000'; end if;
 if not exists(select 1 from public.academic_groups where id=p_class and institution_id=p_institution and group_type='class' and is_active)
 or (p_section is null and exists(select 1 from public.academic_groups where institution_id=p_institution and parent_group_id=p_class and group_type='section' and is_active))
 or (p_section is not null and not exists(select 1 from public.academic_groups where id=p_section and institution_id=p_institution and group_type='section' and parent_group_id=p_class and is_active)) then raise exception 'Choose your school class and its section' using errcode='22023'; end if;
 select * into old from public.noor_student_year_choices where membership_id=m and start_year=w.start_year;
 if old.membership_id is not null then
  if old.class_id=p_class and old.section_id is not distinct from p_section then return jsonb_build_object('class_id',p_class,'section_id',p_section,'already_saved',true); end if;
  raise exception 'Class and section already saved for this year. Ask your principal for a correction.' using errcode='42501';
 end if;
 if not w.is_open and exists(select 1 from public.noor_student_year_choices where membership_id=m) then raise exception 'Your principal has closed class and section updates' using errcode='42501'; end if;
 update public.academic_group_memberships set status='inactive' where membership_id=m and institution_id=p_institution and group_role='student' and status='active';
 insert into public.academic_group_memberships(institution_id,group_id,membership_id,group_role,status)
 select p_institution,gid,m,'student','active' from unnest(array[p_class,p_section]) t(gid) where gid is not null
 on conflict(group_id,membership_id) do update set status='active',group_role='student';
 insert into public.noor_student_year_choices(institution_id,membership_id,start_year,class_id,section_id) values(p_institution,m,w.start_year,p_class,p_section);
 insert into public.noor_audit_events(institution_id,actor_id,action,entity_id,metadata) values(p_institution,auth.uid(),'student.year_class_selected',m,jsonb_build_object('year',w.start_year,'class',p_class,'section',p_section));
 return jsonb_build_object('class_id',p_class,'section_id',p_section);
end $$;

-- Homeroom teacher may manage their students. Only school leadership may manage teachers.
create or replace function private.noor_set_member_status(p_institution uuid,p_membership uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$
declare target public.institution_memberships; teacher uuid;
begin
 if auth.uid() is null or not private.is_active_member(p_institution) then raise exception 'Active school membership required' using errcode='42501'; end if;
 if p_status is null or p_status not in('active','suspended') then raise exception 'Choose active or suspended' using errcode='22023'; end if;
 select * into target from public.institution_memberships where id=p_membership and institution_id=p_institution for update;
 if target.id is null or target.user_id=auth.uid() or target.status not in('active','suspended') or target.role not in('student','university_student','teacher','faculty','staff') then raise exception 'This member cannot be changed' using errcode='42501'; end if;
 if not private.can_manage_academics(p_institution) then
  select id into teacher from public.institution_memberships where user_id=auth.uid() and institution_id=p_institution and status='active' and role in('teacher','faculty');
  if teacher is null or target.role not in('student','university_student') or not exists(select 1 from public.academic_groups g join public.academic_group_memberships gm on gm.group_id=g.id and gm.institution_id=g.institution_id
   where g.institution_id=p_institution and g.homeroom_teacher_membership_id=teacher and gm.membership_id=target.id and gm.status='active' and gm.group_role='student') then raise exception 'Only your own class students can be managed' using errcode='42501'; end if;
 end if;
 update public.institution_memberships set status=p_status,updated_at=now() where id=target.id;
 insert into public.noor_audit_events(institution_id,actor_id,action,entity_id,metadata) values(p_institution,auth.uid(),'membership.status_changed',target.id,jsonb_build_object('status',p_status));
end $$;
create function public.noor_manageable_members(p_institution uuid,p_search text default '') returns jsonb language plpgsql stable security definer set search_path='' as $$
declare me uuid; manager boolean;
begin
 if auth.uid() is null or not private.is_active_member(p_institution) then raise exception 'Active school membership required' using errcode='42501'; end if;
 manager=private.can_manage_academics(p_institution);
 select id into me from public.institution_memberships where institution_id=p_institution and user_id=auth.uid() and status='active' and role in('teacher','faculty');
 if not manager and me is null then raise exception 'Principal or class teacher required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(to_jsonb(x)) from (select m.id membership_id,p.full_name,m.role,m.status,
 (select string_agg(distinct concat_ws(' · ',parent.name,g.name),' / ') from public.academic_group_memberships gm join public.academic_groups g on g.id=gm.group_id left join public.academic_groups parent on parent.id=g.parent_group_id where gm.membership_id=m.id and gm.status='active' and (g.group_type='section' or (g.group_type='class' and not exists(select 1 from public.academic_group_memberships s join public.academic_groups sg on sg.id=s.group_id where s.membership_id=m.id and s.status='active' and sg.group_type='section')))) class_label
 from public.institution_memberships m join public.profiles p on p.id=m.user_id where m.institution_id=p_institution and m.status in('active','suspended') and m.role in('student','university_student','teacher','faculty','staff')
 and (length(trim(coalesce(p_search,'')))=0 or position(lower(left(trim(p_search),100)) in lower(p.full_name))>0)
 and (manager or (m.role in('student','university_student') and exists(select 1 from public.academic_group_memberships gm join public.academic_groups g on g.id=gm.group_id and g.institution_id=gm.institution_id where gm.membership_id=m.id and gm.status='active' and g.homeroom_teacher_membership_id=me))) order by p.full_name,m.id limit 40) x),'[]'::jsonb);
end $$;
-- Gate tenant tables with live membership status even when another permissive self policy exists.
-- Keep membership self-read available so suspended clients can display their locked status.
do $$ declare t record; begin
 for t in select c.table_name from information_schema.columns c join pg_class pc on pc.relname=c.table_name join pg_namespace ns on ns.oid=pc.relnamespace and ns.nspname=c.table_schema
 where c.table_schema='public' and c.column_name='institution_id' and pc.relkind='r' and c.table_name not in('institution_memberships','noor_creator_deliveries','noor_creator_support') loop
 execute format('create policy noor_live_member_gate on public.%I as restrictive for all to authenticated using(private.is_platform_admin() or private.is_active_member(institution_id)) with check(private.is_platform_admin() or private.is_active_member(institution_id))',t.table_name);
 end loop;
end $$;
-- Public wrappers are guarded and never trust editable metadata.
revoke all on function public.noor_class_update_status(uuid),public.noor_set_class_update_window(uuid,integer,boolean),public.noor_manageable_members(uuid,text) from public,anon;
grant execute on function public.noor_class_update_status(uuid),public.noor_set_class_update_window(uuid,integer,boolean),public.noor_manageable_members(uuid,text) to authenticated;
