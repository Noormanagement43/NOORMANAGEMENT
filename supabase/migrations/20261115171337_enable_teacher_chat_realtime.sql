-- Use the existing student portal subscription for live teacher replies.
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='noor_class_questions') then
  alter publication supabase_realtime add table public.noor_class_questions;
 end if;
end $$;
