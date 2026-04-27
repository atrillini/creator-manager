-- Mancava la policy UPDATE su brands: le modifica in app venivano bloccate da RLS
-- (insert e select c'erano; update no → nessun salvataggio referenti in modifica).

create policy "brands_dev_update" on public.brands
  for update
  using (true)
  with check (true);
