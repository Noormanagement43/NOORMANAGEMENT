set local lock_timeout='5s';
set local statement_timeout='60s';
set local search_path=public,extensions,pg_catalog;
-- Cache the caller ID once per statement; correlated school/group checks remain per row.
do $$ declare p record;q text;w text;sql text; begin
 for p in select * from pg_policies where schemaname='public' and policyname in
 ('annual_archive_read','teacher_plans_read','teacher_plans_insert','teacher_plans_update','school_message_create','staff_checkins_insert','principal_tasks_insert') loop
  q:=p.qual;w:=p.with_check;
  if q is not null and q not like '%SELECT auth.uid()%' then q:=replace(q,'auth.uid()','(select auth.uid())');end if;
  if w is not null and w not like '%SELECT auth.uid()%' then w:=replace(w,'auth.uid()','(select auth.uid())');end if;
  sql:=format('alter policy %I on public.%I',p.policyname,p.tablename);
  if q is not null then sql:=sql||' using ('||q||')';end if;
  if w is not null then sql:=sql||' with check ('||w||')';end if;
  execute sql;
 end loop;
end $$;
create index if not exists noor_group_report_group_school on public.noor_group_report_settings(academic_group_id,institution_id);
create index if not exists noor_test_rules_group_school on public.noor_test_rules(academic_group_id,institution_id);
