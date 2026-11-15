-- Small current tables: bounded lock waits, add covering FK indexes, retain exact RLS predicates.
set local lock_timeout='5s';
set local statement_timeout='60s';
set local search_path=public,extensions,pg_catalog;
do $$ declare fk record; cols text; begin
 for fk in select c.oid,c.conrelid,c.conkey,c.conname,n.nspname,t.relname
 from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace
 where c.contype='f' and n.nspname in ('public','private') order by n.nspname,t.relname,c.conname
 loop
  if not exists(select 1 from pg_index i where i.indrelid=fk.conrelid and i.indisvalid and i.indpred is null
    and i.indnkeyatts>=cardinality(fk.conkey) and fk.conkey <@ (i.indkey::smallint[])[0:cardinality(fk.conkey)-1]) then
   select string_agg(format('%I',a.attname),',' order by k.ord) into cols
    from unnest(fk.conkey) with ordinality k(num,ord) join pg_attribute a on a.attrelid=fk.conrelid and a.attnum=k.num;
   execute format('create index if not exists %I on %I.%I (%s)','noor_fk_'||substr(md5(fk.nspname||'.'||fk.relname||'.'||fk.conname),1,16),fk.nspname,fk.relname,cols);
  end if;
 end loop;
end $$;
