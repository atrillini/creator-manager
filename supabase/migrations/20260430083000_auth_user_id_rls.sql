-- Supabase Auth hardening: owner-based data isolation + private app settings
create extension if not exists pgcrypto;

-- 1) Add owner column to main tables
alter table public.brands add column if not exists user_id uuid references auth.users (id);
alter table public.collaborations add column if not exists user_id uuid references auth.users (id);
alter table public.deliverables add column if not exists user_id uuid references auth.users (id);
alter table public.financials add column if not exists user_id uuid references auth.users (id);
alter table public.collaboration_events add column if not exists user_id uuid references auth.users (id);
alter table public.youtube_stats add column if not exists user_id uuid references auth.users (id);
alter table public.collaboration_payments add column if not exists user_id uuid references auth.users (id);

-- 2) Single-admin backfill (first auth user)
with admin_user as (
  select id from auth.users order by created_at asc limit 1
)
update public.brands b
set user_id = a.id
from admin_user a
where b.user_id is null;

with admin_user as (
  select id from auth.users order by created_at asc limit 1
)
update public.collaborations c
set user_id = a.id
from admin_user a
where c.user_id is null;

update public.deliverables d
set user_id = c.user_id
from public.collaborations c
where d.user_id is null
  and c.id = d.collaboration_id;

update public.collaboration_events e
set user_id = c.user_id
from public.collaborations c
where e.user_id is null
  and c.id = e.collaboration_id;

update public.collaboration_payments p
set user_id = c.user_id
from public.collaborations c
where p.user_id is null
  and c.id = p.collaboration_id;

update public.financials f
set user_id = c.user_id
from public.collaborations c
where f.user_id is null
  and f.collaboration_id = c.id;

with admin_user as (
  select id from auth.users order by created_at asc limit 1
)
update public.financials f
set user_id = a.id
from admin_user a
where f.user_id is null;

with admin_user as (
  select id from auth.users order by created_at asc limit 1
)
update public.youtube_stats y
set user_id = a.id
from admin_user a
where y.user_id is null;

-- 3) Enforce not null + indexes
alter table public.brands alter column user_id set not null;
alter table public.collaborations alter column user_id set not null;
alter table public.deliverables alter column user_id set not null;
alter table public.financials alter column user_id set not null;
alter table public.collaboration_events alter column user_id set not null;
alter table public.youtube_stats alter column user_id set not null;
alter table public.collaboration_payments alter column user_id set not null;

create index if not exists brands_user_id_idx on public.brands (user_id);
create index if not exists collaborations_user_id_idx on public.collaborations (user_id);
create index if not exists deliverables_user_id_idx on public.deliverables (user_id);
create index if not exists financials_user_id_idx on public.financials (user_id);
create index if not exists collaboration_events_user_id_idx on public.collaboration_events (user_id);
create index if not exists youtube_stats_user_id_idx on public.youtube_stats (user_id);
create index if not exists collaboration_payments_user_id_idx on public.collaboration_payments (user_id);

-- 4) tenant-safe youtube uniqueness
alter table public.youtube_stats drop constraint if exists youtube_stats_channel_name_key;
alter table public.youtube_stats add constraint youtube_stats_user_channel_unique unique (user_id, channel_name);

-- 5) app private mode settings (global toggle)
create table if not exists public.app_settings (
  id text primary key,
  signup_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),
  constraint app_settings_global_id check (id = 'global')
);
insert into public.app_settings (id, signup_enabled)
values ('global', true)
on conflict (id) do nothing;
alter table public.app_settings enable row level security;

-- 6) Replace dev-open policies with owner policies
drop policy if exists "brands_dev_select" on public.brands;
drop policy if exists "brands_dev_insert" on public.brands;
drop policy if exists "brands_dev_update" on public.brands;

create policy "brands_owner_select" on public.brands
  for select using (auth.uid() = user_id);
create policy "brands_owner_insert" on public.brands
  for insert with check (auth.uid() = user_id);
create policy "brands_owner_update" on public.brands
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "brands_owner_delete" on public.brands
  for delete using (auth.uid() = user_id);

drop policy if exists "collaborations_dev_select" on public.collaborations;
drop policy if exists "collaborations_dev_insert" on public.collaborations;
drop policy if exists "collaborations_dev_update" on public.collaborations;

create policy "collaborations_owner_select" on public.collaborations
  for select using (auth.uid() = user_id);
create policy "collaborations_owner_insert" on public.collaborations
  for insert with check (auth.uid() = user_id);
create policy "collaborations_owner_update" on public.collaborations
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "collaborations_owner_delete" on public.collaborations
  for delete using (auth.uid() = user_id);

drop policy if exists "deliverables_dev_select" on public.deliverables;
drop policy if exists "deliverables_dev_insert" on public.deliverables;
drop policy if exists "deliverables_dev_update" on public.deliverables;

create policy "deliverables_owner_select" on public.deliverables
  for select using (auth.uid() = user_id);
create policy "deliverables_owner_insert" on public.deliverables
  for insert with check (auth.uid() = user_id);
create policy "deliverables_owner_update" on public.deliverables
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "deliverables_owner_delete" on public.deliverables
  for delete using (auth.uid() = user_id);

drop policy if exists "financials_dev_select" on public.financials;
drop policy if exists "financials_dev_insert" on public.financials;

create policy "financials_owner_select" on public.financials
  for select using (auth.uid() = user_id);
create policy "financials_owner_insert" on public.financials
  for insert with check (auth.uid() = user_id);
create policy "financials_owner_update" on public.financials
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "financials_owner_delete" on public.financials
  for delete using (auth.uid() = user_id);

drop policy if exists "collaboration_events_dev_select" on public.collaboration_events;
drop policy if exists "collaboration_events_dev_insert" on public.collaboration_events;
drop policy if exists "collaboration_events_dev_update" on public.collaboration_events;
drop policy if exists "collaboration_events_dev_delete" on public.collaboration_events;

create policy "collaboration_events_owner_select" on public.collaboration_events
  for select using (auth.uid() = user_id);
create policy "collaboration_events_owner_insert" on public.collaboration_events
  for insert with check (auth.uid() = user_id);
create policy "collaboration_events_owner_update" on public.collaboration_events
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "collaboration_events_owner_delete" on public.collaboration_events
  for delete using (auth.uid() = user_id);

drop policy if exists "youtube_stats_dev_select" on public.youtube_stats;
drop policy if exists "youtube_stats_dev_insert" on public.youtube_stats;
drop policy if exists "youtube_stats_dev_update" on public.youtube_stats;

create policy "youtube_stats_owner_select" on public.youtube_stats
  for select using (auth.uid() = user_id);
create policy "youtube_stats_owner_insert" on public.youtube_stats
  for insert with check (auth.uid() = user_id);
create policy "youtube_stats_owner_update" on public.youtube_stats
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "youtube_stats_owner_delete" on public.youtube_stats
  for delete using (auth.uid() = user_id);

drop policy if exists "collaboration_payments_dev_select" on public.collaboration_payments;
drop policy if exists "collaboration_payments_dev_insert" on public.collaboration_payments;
drop policy if exists "collaboration_payments_dev_update" on public.collaboration_payments;
drop policy if exists "collaboration_payments_dev_delete" on public.collaboration_payments;

create policy "collaboration_payments_owner_select" on public.collaboration_payments
  for select using (auth.uid() = user_id);
create policy "collaboration_payments_owner_insert" on public.collaboration_payments
  for insert with check (auth.uid() = user_id);
create policy "collaboration_payments_owner_update" on public.collaboration_payments
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "collaboration_payments_owner_delete" on public.collaboration_payments
  for delete using (auth.uid() = user_id);

drop policy if exists "app_settings_public_read" on public.app_settings;
drop policy if exists "app_settings_auth_write" on public.app_settings;

create policy "app_settings_public_read" on public.app_settings
  for select using (true);
create policy "app_settings_auth_write" on public.app_settings
  for all
  to authenticated
  using (true)
  with check (true);
