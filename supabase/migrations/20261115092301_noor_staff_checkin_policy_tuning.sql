set local lock_timeout='5s';
do $$ declare p record;q text;w text;s text;begin
 select * into p from pg_policies where schemaname='public' and tablename='noor_staff_checkins' and policyname='staff_checkins_update';
 if found then
 q:=replace(p.qual,'auth.uid()','(select auth.uid())');w:=replace(p.with_check,'auth.uid()','(select auth.uid())');
 s:='alter policy staff_checkins_update on public.noor_staff_checkins using ('||q||')';
 if w is not null then s:=s||' with check ('||w||')';end if;execute s;
 end if;
end $$;
