-- READ ONLY. Run with an authorized monitoring connection; never put DB credentials in a browser.
BEGIN READ ONLY;
SET LOCAL statement_timeout='5s';
SELECT now() captured_at, pg_database_size(current_database()) database_bytes,
 current_setting('max_connections')::integer connection_ceiling;
SELECT state,count(*) connections FROM pg_stat_activity GROUP BY state;
SELECT schemaname,relname,n_live_tup estimated_rows,n_dead_tup estimated_dead_rows,
 last_autovacuum,last_autoanalyze,seq_scan,idx_scan FROM pg_stat_user_tables
 WHERE schemaname='public' ORDER BY n_live_tup DESC;
-- Cumulative execution times are not API p95. Do not reset shared statistics to benchmark.
SELECT queryid,calls,mean_exec_time,max_exec_time,rows FROM extensions.pg_stat_statements
 ORDER BY total_exec_time DESC LIMIT 20;
SELECT state,count(*) jobs,min(created_at) oldest_created FROM public.noor_workflow_jobs GROUP BY state;
SELECT status,count(*) jobs,min(created_at) oldest_created FROM public.ai_generation_jobs GROUP BY status;
SELECT c.relname,c.relrowsecurity,EXISTS(SELECT 1 FROM pg_constraint k WHERE k.conrelid=c.oid AND k.contype='p') has_primary_key
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname;
ROLLBACK;
