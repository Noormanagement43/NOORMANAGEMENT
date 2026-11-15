set local lock_timeout='5s';
set local statement_timeout='60s';
set local search_path=public,extensions,pg_catalog;
-- FOR ALL is split into its original four operations, then permissive OR branches are combined.
-- Restrictive live-membership and feature-control policies are intentionally preserved.
do $$ declare p record;g record;cmd text;q text;w text;sql text;begin
 for p in select * from pg_policies where schemaname='public' and tablename in
 ('noor_group_report_settings','noor_student_display_preferences','teacher_timetable_periods')
 and permissive='PERMISSIVE' and roles=array['authenticated']::name[] and pg_policies.cmd='ALL' loop
  execute format('drop policy %I on public.%I',p.policyname,p.tablename);
  foreach cmd in array array['SELECT','INSERT','UPDATE','DELETE'] loop
   sql:=format('create policy %I on public.%I for %s to authenticated',p.policyname||'_'||lower(cmd),p.tablename,cmd);
   if cmd<>'INSERT' then sql:=sql||' using ('||coalesce(p.qual,'true')||')';end if;
   if cmd in ('INSERT','UPDATE') then sql:=sql||' with check ('||coalesce(p.with_check,p.qual,'true')||')';end if;
   execute sql;
  end loop;
 end loop;
 for g in select tablename,pg_policies.cmd as operation from pg_policies where schemaname='public'
 and tablename in ('noor_group_report_settings','noor_student_display_preferences','teacher_timetable_periods')
 and permissive='PERMISSIVE' and roles=array['authenticated']::name[] group by tablename,pg_policies.cmd having count(*)>1 loop
  select string_agg('('||coalesce(qual,'true')||')',' OR ' order by policyname),
   string_agg('('||coalesce(with_check,qual,'true')||')',' OR ' order by policyname) into q,w
   from pg_policies where schemaname='public' and tablename=g.tablename and pg_policies.cmd=g.operation
   and permissive='PERMISSIVE' and roles=array['authenticated']::name[];
  for p in select policyname from pg_policies where schemaname='public' and tablename=g.tablename and pg_policies.cmd=g.operation
   and permissive='PERMISSIVE' and roles=array['authenticated']::name[] loop
   execute format('drop policy %I on public.%I',p.policyname,g.tablename);
  end loop;
  sql:=format('create policy %I on public.%I for %s to authenticated','noor_unified_'||lower(g.operation),g.tablename,g.operation);
  if g.operation<>'INSERT' then sql:=sql||' using ('||q||')';end if;
  if g.operation in ('INSERT','UPDATE') then sql:=sql||' with check ('||w||')';end if;
  execute sql;
 end loop;
end $$;
