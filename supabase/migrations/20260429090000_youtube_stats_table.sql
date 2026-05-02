create table if not exists public.youtube_stats (
  id uuid primary key default gen_random_uuid (),
  channel_name text not null,
  subscriber_count numeric not null default 0,
  view_count numeric not null default 0,
  avatar_url text,
  updated_at timestamptz not null default now (),
  unique (channel_name)
);

alter table public.youtube_stats enable row level security;

create policy "youtube_stats_dev_select" on public.youtube_stats
  for select
  using (true);

create policy "youtube_stats_dev_insert" on public.youtube_stats
  for insert
  with check (true);

create policy "youtube_stats_dev_update" on public.youtube_stats
  for update
  using (true)
  with check (true);
