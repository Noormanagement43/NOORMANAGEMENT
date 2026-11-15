-- School preferences can only narrow Creator-granted access. All existing RLS,
-- RPC and write guards continue using the same effective feature predicate.
create table public.noor_school_feature_settings (
 institution_id uuid not null references public.institutions on delete cascade,
 feature_key text not null references public.noor_feature_catalog,
 enabled boolean not null default true,
 updated_by uuid not null references auth.users,
 updated_at timestamptz not null default now(),
 primary key(institution_id,feature_key)
);
alter table public.noor_school_feature_settings enable row level security;
revoke all on public.noor_school_feature_settings from public,anon,authenticated;
grant select on public.noor_school_feature_settings to authenticated;
grant all on public.noor_school_feature_settings to service_role;
create policy school_feature_settings_read on public.noor_school_feature_settings
 for select to authenticated using (private.is_active_member(institution_id));

-- Preserve the Creator predicate, including parent feature dependencies.
create function private.noor_creator_feature_enabled(p_inst uuid,p_key text)
 returns boolean language sql stable security definer set search_path='' as $$
 select private.noor_institute_running(p_inst) and coalesce(
 (select o.enabled from public.noor_feature_overrides o where o.institution_id=p_inst and o.feature_key=p_key),
 (select d.enabled from public.noor_feature_defaults d where d.feature_key=p_key),true)
 and case when p_key in ('smart_notes','annual_cards') then coalesce(
 (select o.enabled from public.noor_feature_overrides o where o.institution_id=p_inst and o.feature_key=case when p_key='smart_notes' then 'library' else 'report_cards' end),
 (select d.enabled from public.noor_feature_defaults d where d.feature_key=case when p_key='smart_notes' then 'library' else 'report_cards' end),true) else true end
$$;
revoke all on function private.noor_creator_feature_enabled(uuid,text) from public,anon,authenticated;

create or replace function private.noor_feature_enabled(p_inst uuid,p_key text)
 returns boolean language sql stable security definer set search_path='' as $$
 select private.noor_creator_feature_enabled(p_inst,p_key)
 and coalesce((select s.enabled from public.noor_school_feature_settings s where s.institution_id=p_inst and s.feature_key=p_key),true)
 and case when p_key in ('smart_notes','annual_cards') then coalesce(
 (select s.enabled from public.noor_school_feature_settings s where s.institution_id=p_inst and s.feature_key=case when p_key='smart_notes' then 'library' else 'report_cards' end),true) else true end
$$;

create function private.noor_school_features(p_institution uuid,p_changes jsonb)
 returns jsonb language plpgsql security definer set search_path='' as $$
 declare k text; v jsonb;
 begin
 if auth.uid() is null or not private.has_institution_role(p_institution,array['principal','university_admin','school_admin']) then
  raise exception 'Active school leadership required' using errcode='42501';
 end if;
 if p_changes is null or jsonb_typeof(p_changes)<>'object' then raise exception 'Feature settings must be an object'; end if;
 for k,v in select * from jsonb_each(p_changes) loop
  if jsonb_typeof(v)<>'boolean' or not exists(select 1 from public.noor_feature_catalog c where c.feature_key=k) then
   raise exception 'Unknown feature or invalid setting';
  end if;
  if not private.noor_creator_feature_enabled(p_institution,k) then
   raise exception 'This feature is disabled by NOOR Management' using errcode='42501';
  end if;
 end loop;
 for k,v in select * from jsonb_each(p_changes) loop
  insert into public.noor_school_feature_settings(institution_id,feature_key,enabled,updated_by)
  values(p_institution,k,(v#>>'{}')::boolean,auth.uid())
  on conflict(institution_id,feature_key) do update set enabled=excluded.enabled,updated_by=excluded.updated_by,updated_at=now();
 end loop;
 if p_changes<>'{}'::jsonb then
  insert into public.noor_creator_activity(actor_id,action,institution_ids,details)
  values(auth.uid(),'school_features',array[p_institution],jsonb_build_object('changes',p_changes));
 end if;
 return jsonb_build_object('catalog',(select jsonb_agg(jsonb_build_object(
  'feature_key',c.feature_key,'label',c.label,'category',c.category,'description',c.description,
  'creator_allowed',private.noor_creator_feature_enabled(p_institution,c.feature_key),
  'school_enabled',coalesce(s.enabled,true),'enabled',private.noor_feature_enabled(p_institution,c.feature_key)
 ) order by c.category,c.label) from public.noor_feature_catalog c left join public.noor_school_feature_settings s on s.institution_id=p_institution and s.feature_key=c.feature_key));
 end $$;
create function public.noor_school_features(p_institution uuid,p_changes jsonb default '{}'::jsonb)
 returns jsonb language sql security invoker set search_path='' as $$
 select private.noor_school_features(p_institution,p_changes)
$$;
revoke all on function private.noor_school_features(uuid,jsonb),public.noor_school_features(uuid,jsonb) from public,anon;
grant execute on function private.noor_school_features(uuid,jsonb),public.noor_school_features(uuid,jsonb) to authenticated;

-- Calendar being OFF must not turn off separate notices and meetings.
do $$ declare def text; begin
 select pg_get_functiondef('private.noor_row_feature(text,jsonb)'::regprocedure) into def;
 if position('when ''noor_calendar_events'' then ''calendar''' in def)=0 then raise exception 'Calendar feature guard not found'; end if;
 def:=replace(def,'when ''noor_calendar_events'' then ''calendar''','when ''noor_calendar_events'' then case when p_row->>''kind'' in (''notice'',''meeting'') then ''notices'' else ''calendar'' end');
 execute def;
end $$;
