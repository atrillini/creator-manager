-- Collegamento Google (YouTube) gestito dall'app: il refresh token vive nel DB,
-- non più in GOOGLE_REFRESH_TOKEN. Nessuna policy: leggibile/scrivibile solo dal
-- server con service role (il token non arriva mai al browser).

create table if not exists public.google_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  refresh_token text not null,
  scopes text[] not null default '{}',
  google_email text,
  connected_at timestamptz not null default now (),
  updated_at timestamptz not null default now (),
  last_sync_at timestamptz,
  last_error text,
  last_error_at timestamptz
);

alter table public.google_connections enable row level security;

comment on table public.google_connections is
  'Token OAuth Google per la sync YouTube. Accesso solo via service role.';
