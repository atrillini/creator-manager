-- Pulizia una tantum: i thread importati dalla vecchia inbox erano tutti "nuova".
-- Le conversazioni ferme da più di 14 giorni sono storico: passano a "gestita"
-- (stessa regola che la sync applica ai thread dell'import storico).
-- Se il brand riscrive, la sync le riporta a "da rispondere".

update public.email_threads
set status = 'gestita', updated_at = now ()
where status in ('nuova', 'da_rispondere')
  and last_message_at < now () - interval '14 days';
