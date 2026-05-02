create extension if not exists pgcrypto;

create table if not exists public.email_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users (id),
  provider text not null default 'icloud',
  mailbox text not null default 'INBOX',
  external_message_id text not null,
  thread_key text not null,
  in_reply_to text,
  references_ids text[] not null default '{}',
  from_name text,
  from_email text,
  to_emails text[] not null default '{}',
  subject text not null default '',
  preview text not null default '',
  body_text text not null default '',
  body_html text,
  received_at timestamptz not null,
  last_synced_at timestamptz not null default now(),
  constraint email_messages_user_provider_mailbox_external_unique
    unique (user_id, provider, mailbox, external_message_id)
);

create index if not exists email_messages_user_received_idx
  on public.email_messages (user_id, received_at desc);
create index if not exists email_messages_user_thread_idx
  on public.email_messages (user_id, thread_key, received_at desc);

create table if not exists public.email_tags (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users (id),
  name text not null,
  color text,
  constraint email_tags_user_name_unique unique (user_id, name)
);

create index if not exists email_tags_user_name_idx
  on public.email_tags (user_id, name);

create table if not exists public.email_message_tags (
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users (id),
  message_id uuid not null references public.email_messages (id) on delete cascade,
  tag_id uuid not null references public.email_tags (id) on delete cascade,
  constraint email_message_tags_pkey primary key (message_id, tag_id)
);

create index if not exists email_message_tags_user_idx
  on public.email_message_tags (user_id, message_id);

alter table public.email_messages enable row level security;
alter table public.email_tags enable row level security;
alter table public.email_message_tags enable row level security;

create policy "email_messages_owner_select" on public.email_messages
  for select using (auth.uid() = user_id);
create policy "email_messages_owner_insert" on public.email_messages
  for insert with check (auth.uid() = user_id);
create policy "email_messages_owner_update" on public.email_messages
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "email_messages_owner_delete" on public.email_messages
  for delete using (auth.uid() = user_id);

create policy "email_tags_owner_select" on public.email_tags
  for select using (auth.uid() = user_id);
create policy "email_tags_owner_insert" on public.email_tags
  for insert with check (auth.uid() = user_id);
create policy "email_tags_owner_update" on public.email_tags
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "email_tags_owner_delete" on public.email_tags
  for delete using (auth.uid() = user_id);

create policy "email_message_tags_owner_select" on public.email_message_tags
  for select using (auth.uid() = user_id);
create policy "email_message_tags_owner_insert" on public.email_message_tags
  for insert with check (auth.uid() = user_id);
create policy "email_message_tags_owner_delete" on public.email_message_tags
  for delete using (auth.uid() = user_id);
