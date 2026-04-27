-- Consenti modifica e cancellazione eventi timeline (fase dev; restringi in produzione)
create policy "collaboration_events_dev_update" on public.collaboration_events
  for update
  using (true)
  with check (true);

create policy "collaboration_events_dev_delete" on public.collaboration_events
  for delete
  using (true);
