select cron.schedule(
 'noor-brevo-email-worker',
 '* * * * *',
 $worker$
 select net.http_post(
  url := 'https://ayrryemawwplguaauxij.supabase.co/functions/v1/noor-email-worker',
  headers := jsonb_build_object(
   'Content-Type','application/json',
   'x-noor-worker-token',(select token_value from private.noor_worker_credentials where name='email-worker')
  ),
  body := '{}'::jsonb,
  timeout_milliseconds := 15000
 );
 $worker$
);
