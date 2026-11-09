-- Enable the supported Postgres scheduler, then run the durable reminder queue every minute.
create extension if not exists pg_cron;
do $$ begin
 perform cron.unschedule(jobid) from cron.job where jobname='noor-cc-task-reminders';
 perform cron.schedule('noor-cc-task-reminders','* * * * *','select private.noor_cc_queue_due_task_reminders();');
end $$;