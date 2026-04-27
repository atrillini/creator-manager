-- collaboration_events, general_notes, storage bucket, policy aggiuntive
create extension if not exists pgcrypto;

-- Colonna appunti liberi sulla collaborazione
alter table public.collaborations
add column if not exists general_notes text;

-- Eventi di timeline
create table public.collaboration_events (
  id uuid primary key default gen_random_uuid (),
  created_at timestamptz not null default now (),
  collaboration_id uuid not null
    references public.collaborations (id) on delete cascade,
  event_type text not null
    check (
      event_type in (
        'email',
        'meeting',
        'trattativa',
        'file',
        'nota'
      )
    ),
  description text,
  attached_file_url text
);

create index collaboration_events_collaboration_id_idx
  on public.collaboration_events (collaboration_id, created_at desc);

alter table public.collaboration_events enable row level security;

create policy "collaboration_events_dev_select" on public.collaboration_events
  for select
  using (true);

create policy "collaboration_events_dev_insert" on public.collaboration_events
  for insert
  with check (true);

-- Aggiornamento general_notes in dev
create policy "collaborations_dev_update" on public.collaborations
  for update
  using (true)
  with check (true);

-- Per modificare i deliverable (es. stato) in seguito
create policy "deliverables_dev_update" on public.deliverables
  for update
  using (true)
  with check (true);

alter publication supabase_realtime add table public.collaboration_events;

-- ---------------------------------------------------------------------------
-- Storage: allegati timeline (brief, contratti, PDF, immagini)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'collaboration-files',
  'collaboration-files',
  true,
  52428800, -- 50 MB
  array['application/pdf', 'image/png', 'image/jpeg', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- fase dev: accesso aperto per anon e authenticated
create policy "collab_files_read"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'collaboration-files');

create policy "collab_files_insert"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'collaboration-files');

create policy "collab_files_update"
on storage.objects
for update
to anon, authenticated
using (bucket_id = 'collaboration-files')
with check (bucket_id = 'collaboration-files');

create policy "collab_files_delete"
on storage.objects
for delete
to anon, authenticated
using (bucket_id = 'collaboration-files');
