-- Sistemazione sicurezza + movimenti finanziari manuali
-- 1) Allegati timeline: bucket privato, accesso solo al proprietario della collaborazione
-- 2) app_settings: nessuna scrittura dal client (la fa il server con service role, solo admin)
-- 3) financials: descrizione + nuovi tipi per movimenti manuali

-- ---------------------------------------------------------------------------
-- 1) Allegati: path nel bucket al posto dell'URL pubblico
-- ---------------------------------------------------------------------------

alter table public.collaboration_events
  add column if not exists attached_file_path text;

comment on column public.collaboration_events.attached_file_path is
  'Oggetto nel bucket privato collaboration-files (collabs/<collaboration_id>/...)';
comment on column public.collaboration_events.attached_file_url is
  'Solo link esterni legacy; i file caricati usano attached_file_path';

update public.collaboration_events
set
  attached_file_path = substring(attached_file_url from '/object/public/collaboration-files/(.+)$'),
  attached_file_url = null
where attached_file_path is null
  and attached_file_url ~ '/object/public/collaboration-files/';

update storage.buckets set public = false where id = 'collaboration-files';

drop policy if exists "collab_files_read" on storage.objects;
drop policy if exists "collab_files_insert" on storage.objects;
drop policy if exists "collab_files_update" on storage.objects;
drop policy if exists "collab_files_delete" on storage.objects;

-- Path: collabs/<collaboration_id>/<uuid>/<file> → foldername[2] = collaboration_id
create policy "collab_files_owner_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'collaboration-files'
    and exists (
      select 1 from public.collaborations c
      where c.id::text = (storage.foldername (name))[2]
        and c.user_id = auth.uid ()
    )
  );

create policy "collab_files_owner_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'collaboration-files'
    and exists (
      select 1 from public.collaborations c
      where c.id::text = (storage.foldername (name))[2]
        and c.user_id = auth.uid ()
    )
  );

create policy "collab_files_owner_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'collaboration-files'
    and exists (
      select 1 from public.collaborations c
      where c.id::text = (storage.foldername (name))[2]
        and c.user_id = auth.uid ()
    )
  );

create policy "collab_files_owner_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'collaboration-files'
    and exists (
      select 1 from public.collaborations c
      where c.id::text = (storage.foldername (name))[2]
        and c.user_id = auth.uid ()
    )
  );

-- ---------------------------------------------------------------------------
-- 2) app_settings: lettura pubblica, scrittura solo via service role
-- ---------------------------------------------------------------------------

drop policy if exists "app_settings_auth_write" on public.app_settings;

-- ---------------------------------------------------------------------------
-- 3) financials: movimenti manuali (entrate extra e spese)
-- ---------------------------------------------------------------------------

alter table public.financials add column if not exists description text;

alter table public.financials drop constraint if exists financials_type_check;
alter table public.financials add constraint financials_type_check
  check (
    type in (
      'Entrata YouTube',
      'Entrata Sponsor',
      'Altra entrata',
      'Spesa Materiale',
      'Altra spesa'
    )
  );

comment on column public.financials.amount is
  'Importo sempre positivo: il segno dipende dal tipo (Spesa* = uscita)';

update public.financials set amount = abs(amount) where type like 'Spesa%' and amount < 0;
