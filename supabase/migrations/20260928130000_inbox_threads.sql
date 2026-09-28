-- Inbox collaborazioni v2
-- - email_threads: una riga per conversazione, aggiornata dalla sync (la lista legge solo qui)
-- - catalogazione: categoria, stato, brand, collaborazione, tag, analisi AI
-- - sync IMAP incrementale (ultimo UID per cartella) e messaggi in uscita (Inviati)
-- - ricerca full-text (senza accenti) su oggetto, persone, riassunto e testo

create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------------
-- Brand: domini email per l'associazione automatica
-- ---------------------------------------------------------------------------

alter table public.brands
  add column if not exists email_domains text[] not null default '{}';

comment on column public.brands.email_domains is
  'Domini email del brand (es. brand.com): le email da questi domini vengono associate in automatico';

-- ---------------------------------------------------------------------------
-- Thread
-- ---------------------------------------------------------------------------

create table if not exists public.email_threads (
  id uuid primary key default gen_random_uuid (),
  created_at timestamptz not null default now (),
  updated_at timestamptz not null default now (),
  user_id uuid not null references auth.users (id) on delete cascade,
  thread_key text not null,
  subject text not null default '',
  first_message_at timestamptz,
  last_message_at timestamptz,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  message_count integer not null default 0,
  participants text[] not null default '{}',
  last_from_name text,
  last_from_email text,
  last_direction text,
  last_preview text not null default '',
  status text not null default 'nuova'
    check (status in ('nuova', 'da_rispondere', 'in_attesa', 'gestita', 'archiviata')),
  category text
    check (
      category in (
        'proposta',
        'gifting',
        'trattativa',
        'produzione',
        'amministrazione',
        'eventi',
        'non_pertinente'
      )
    ),
  category_source text check (category_source in ('ai', 'manuale')),
  brand_id uuid references public.brands (id) on delete set null,
  brand_source text check (brand_source in ('regola', 'ai', 'manuale')),
  collaboration_id uuid references public.collaborations (id) on delete set null,
  is_agency boolean not null default false,
  quality text check (quality in ('alta', 'media', 'bassa')),
  is_urgent boolean not null default false,
  ai_status text not null default 'pending'
    check (ai_status in ('pending', 'done', 'error', 'skipped')),
  ai_summary text,
  ai_insights jsonb,
  ai_model text,
  ai_error text,
  ai_analyzed_at timestamptz,
  ai_message_count integer not null default 0,
  search tsvector,
  constraint email_threads_user_thread_key_unique unique (user_id, thread_key)
);

create index if not exists email_threads_user_last_idx
  on public.email_threads (user_id, last_message_at desc);
create index if not exists email_threads_user_status_idx
  on public.email_threads (user_id, status, last_message_at desc);
create index if not exists email_threads_user_category_idx
  on public.email_threads (user_id, category);
create index if not exists email_threads_brand_idx on public.email_threads (brand_id);
create index if not exists email_threads_collaboration_idx on public.email_threads (collaboration_id);
create index if not exists email_threads_ai_pending_idx
  on public.email_threads (user_id, ai_status) where ai_status = 'pending';
create index if not exists email_threads_search_idx on public.email_threads using gin (search);

alter table public.email_threads enable row level security;

create policy "email_threads_owner_select" on public.email_threads
  for select using (auth.uid () = user_id);
create policy "email_threads_owner_insert" on public.email_threads
  for insert with check (auth.uid () = user_id);
create policy "email_threads_owner_update" on public.email_threads
  for update using (auth.uid () = user_id) with check (auth.uid () = user_id);
create policy "email_threads_owner_delete" on public.email_threads
  for delete using (auth.uid () = user_id);

-- ---------------------------------------------------------------------------
-- Messaggi: legame al thread, direzione, allegati, UID IMAP
-- ---------------------------------------------------------------------------

alter table public.email_messages
  add column if not exists thread_id uuid references public.email_threads (id) on delete cascade;
alter table public.email_messages
  add column if not exists direction text not null default 'in';
alter table public.email_messages
  drop constraint if exists email_messages_direction_check;
alter table public.email_messages
  add constraint email_messages_direction_check check (direction in ('in', 'out'));
alter table public.email_messages
  add column if not exists attachments jsonb not null default '[]'::jsonb;
alter table public.email_messages
  add column if not exists imap_uid bigint;

comment on column public.email_messages.attachments is
  'Metadati allegati: [{filename, contentType, size}] (i file restano nella casella)';

create index if not exists email_messages_thread_idx
  on public.email_messages (thread_id, received_at);
create index if not exists email_messages_user_external_idx
  on public.email_messages (user_id, external_message_id);

-- ---------------------------------------------------------------------------
-- Tag a livello di thread
-- ---------------------------------------------------------------------------

create table if not exists public.email_thread_tags (
  created_at timestamptz not null default now (),
  user_id uuid not null references auth.users (id) on delete cascade,
  thread_id uuid not null references public.email_threads (id) on delete cascade,
  tag_id uuid not null references public.email_tags (id) on delete cascade,
  constraint email_thread_tags_pkey primary key (thread_id, tag_id)
);

create index if not exists email_thread_tags_tag_idx on public.email_thread_tags (tag_id);

alter table public.email_thread_tags enable row level security;

create policy "email_thread_tags_owner_select" on public.email_thread_tags
  for select using (auth.uid () = user_id);
create policy "email_thread_tags_owner_insert" on public.email_thread_tags
  for insert with check (auth.uid () = user_id);
create policy "email_thread_tags_owner_delete" on public.email_thread_tags
  for delete using (auth.uid () = user_id);

-- ---------------------------------------------------------------------------
-- Stato sync IMAP (scritto dal job con service role)
-- ---------------------------------------------------------------------------

create table if not exists public.email_sync_state (
  user_id uuid not null references auth.users (id) on delete cascade,
  mailbox text not null,
  uid_validity text,
  last_uid bigint not null default 0,
  backfill_since date,
  last_run_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  constraint email_sync_state_pkey primary key (user_id, mailbox)
);

alter table public.email_sync_state enable row level security;

create policy "email_sync_state_owner_select" on public.email_sync_state
  for select using (auth.uid () = user_id);

-- ---------------------------------------------------------------------------
-- Aggregati + indice di ricerca del thread, ricalcolati dai messaggi
-- ---------------------------------------------------------------------------

create or replace function public.refresh_email_threads (p_thread_ids uuid[])
returns void
language sql
security invoker
set search_path = public, extensions
as $$
  update public.email_threads t
  set
    message_count = agg.cnt,
    first_message_at = agg.first_at,
    last_message_at = agg.last_at,
    last_inbound_at = agg.last_in,
    last_outbound_at = agg.last_out,
    participants = agg.participants,
    last_from_name = latest.from_name,
    last_from_email = latest.from_email,
    last_direction = latest.direction,
    last_preview = coalesce(latest.preview, ''),
    search =
      setweight(to_tsvector('simple', unaccent(coalesce(t.subject, ''))), 'A')
      || setweight(to_tsvector('simple', unaccent(coalesce(agg.people, ''))), 'B')
      || setweight(to_tsvector('simple', unaccent(coalesce(t.ai_summary, ''))), 'B')
      || setweight(to_tsvector('simple', unaccent(coalesce(agg.bodies, ''))), 'D'),
    updated_at = now()
  from (
    select
      m.thread_id,
      count(*)::int as cnt,
      min(m.received_at) as first_at,
      max(m.received_at) as last_at,
      max(m.received_at) filter (where m.direction = 'in') as last_in,
      max(m.received_at) filter (where m.direction = 'out') as last_out,
      coalesce(
        array_agg(distinct m.from_email) filter (where m.direction = 'in' and m.from_email is not null),
        '{}'
      ) as participants,
      string_agg(distinct coalesce(m.from_name, '') || ' ' || coalesce(m.from_email, ''), ' ') as people,
      left(string_agg(left(m.body_text, 20000), ' ' order by m.received_at), 300000) as bodies
    from public.email_messages m
    where m.thread_id = any (p_thread_ids)
    group by m.thread_id
  ) agg
  cross join lateral (
    select m2.from_name, m2.from_email, m2.direction, m2.preview
    from public.email_messages m2
    where m2.thread_id = agg.thread_id
    order by m2.received_at desc
    limit 1
  ) latest
  where t.id = agg.thread_id;
$$;

-- ---------------------------------------------------------------------------
-- Migrazione dati esistenti
-- ---------------------------------------------------------------------------

-- Chiave thread = messaggio radice (References[0] → In-Reply-To → se stesso):
-- la vecchia chiave basata sull'oggetto separava la prima email dalle risposte.
update public.email_messages
set thread_key = coalesce(nullif(references_ids[1], ''), nullif(in_reply_to, ''), external_message_id);

insert into public.email_threads (user_id, thread_key, subject)
select distinct on (m.user_id, m.thread_key)
  m.user_id,
  m.thread_key,
  regexp_replace(m.subject, '^\s*((re|r|fw|fwd|i|inoltra)\s*:\s*)+', '', 'i')
from public.email_messages m
order by m.user_id, m.thread_key, m.received_at asc
on conflict (user_id, thread_key) do nothing;

update public.email_messages m
set thread_id = t.id
from public.email_threads t
where m.thread_id is null
  and t.user_id = m.user_id
  and t.thread_key = m.thread_key;

select public.refresh_email_threads (array_agg(id)) from public.email_threads;

insert into public.email_thread_tags (user_id, thread_id, tag_id)
select distinct mt.user_id, m.thread_id, mt.tag_id
from public.email_message_tags mt
join public.email_messages m on m.id = mt.message_id
where m.thread_id is not null
on conflict do nothing;

comment on table public.email_message_tags is
  'Legacy: i tag ora sono per thread (email_thread_tags). Tabella mantenuta solo come storico.';
