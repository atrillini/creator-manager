-- Job schedulati (pg_cron + pg_net): da eseguire UNA VOLTA nell'SQL Editor di Supabase.
-- Non è una migration perché contiene URL e segreto del tuo deploy.
--
-- 1) Sostituisci i due valori qui sotto:
--    <APP_URL>      es. https://creator-manager.vercel.app (senza / finale)
--    <CRON_SECRET>  lo stesso valore della variabile CRON_SECRET su Vercel
--                   (generane uno con: openssl rand -hex 32)

create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret('<APP_URL>', 'app_url');
select vault.create_secret('<CRON_SECRET>', 'cron_secret');

-- Inbox: email nuove + analisi AI, ogni 15 minuti
select cron.schedule(
  'inbox-sync',
  '*/15 * * * *',
  $$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_url') || '/api/cron/inbox-sync',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    timeout_milliseconds := 60000
  );
  $$
);

-- YouTube: canale + ricavi, ogni giorno alle 05:00 UTC
select cron.schedule(
  'youtube-sync',
  '0 5 * * *',
  $$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_url') || '/api/cron/youtube-sync',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    timeout_milliseconds := 60000
  );
  $$
);

-- Verifica:
--   select jobname, schedule, active from cron.job;
--   select * from cron.job_run_details order by start_time desc limit 10;
--   select id, status_code, left(content::text, 300) from net._http_response order by created desc limit 10;
-- Per cambiare un valore: select vault.update_secret((select id from vault.secrets where name = 'app_url'), '<nuovo>');
-- Per fermare un job:     select cron.unschedule('inbox-sync');
