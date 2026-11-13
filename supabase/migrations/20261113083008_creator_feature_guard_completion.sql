-- A library/report dependency cannot be bypassed by calling its child feature directly.
create or replace function private.noor_feature_enabled(p_inst uuid,p_key text) returns boolean language sql stable security definer set search_path='' as $$
 select private.noor_institute_running(p_inst) and coalesce(
 (select o.enabled from public.noor_feature_overrides o where o.institution_id=p_inst and o.feature_key=p_key),
 (select d.enabled from public.noor_feature_defaults d where d.feature_key=p_key),true)
 and case when p_key in ('smart_notes','annual_cards') then coalesce(
 (select o.enabled from public.noor_feature_overrides o where o.institution_id=p_inst and o.feature_key=case when p_key='smart_notes' then 'library' else 'report_cards' end),
 (select d.enabled from public.noor_feature_defaults d where d.feature_key=case when p_key='smart_notes' then 'library' else 'report_cards' end),true) else true end
$$;
-- Prepare in-app billing reminders even if external email is not ready yet.
create function public.noor_creator_prepare_reminders() returns void language sql security invoker set search_path='' as $$ select private.noor_creator_prepare_reminders() $$;
revoke all on function public.noor_creator_prepare_reminders() from public,anon,authenticated;
grant execute on function private.noor_creator_prepare_reminders(),public.noor_creator_prepare_reminders() to service_role;
-- Photo/profile uploads and logo changes also respect their creator control.
create policy noor_creator_storage_insert on storage.objects as restrictive for insert to authenticated with check(
 case when bucket_id='noor-profile-photos' then not exists(select 1 from public.institution_memberships m where m.user_id=auth.uid() and m.status='active' and not private.noor_feature_enabled(m.institution_id,'profile_edit'))
 when bucket_id='noor-school-logos' then private.noor_feature_enabled(private.noor_logo_tenant(name),'school_settings') else true end);
create policy noor_creator_storage_update on storage.objects as restrictive for update to authenticated using(
 case when bucket_id='noor-profile-photos' then not exists(select 1 from public.institution_memberships m where m.user_id=auth.uid() and m.status='active' and not private.noor_feature_enabled(m.institution_id,'profile_edit'))
 when bucket_id='noor-school-logos' then private.noor_feature_enabled(private.noor_logo_tenant(name),'school_settings') else true end)
 with check(case when bucket_id='noor-profile-photos' then not exists(select 1 from public.institution_memberships m where m.user_id=auth.uid() and m.status='active' and not private.noor_feature_enabled(m.institution_id,'profile_edit')) when bucket_id='noor-school-logos' then private.noor_feature_enabled(private.noor_logo_tenant(name),'school_settings') else true end);
