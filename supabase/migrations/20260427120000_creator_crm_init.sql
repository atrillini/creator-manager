-- CreatorCRM — migration iniziale
-- Eseguire con: supabase db push (o SQL Editor in Supabase)

-- Necessario per gen_random_uuid(); su Supabase spesso già abilitata
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tabelle
-- ---------------------------------------------------------------------------

create table public.brands (
  id uuid primary key default gen_random_uuid (),
  created_at timestamptz not null default now (),
  name text not null,
  contacts text,
  sector text,
  notes text
);

create table public.collaborations (
  id uuid primary key default gen_random_uuid (),
  created_at timestamptz not null default now (),
  brand_id uuid not null references public.brands (id) on delete restrict,
  status text not null
    check (
      status in (
        'proposta',
        'in valutazione',
        'accettata',
        'rifiutata',
        'completata'
      )
    ),
  agreed_fee numeric,
  brief_text text,
  contract_url text
);

create table public.deliverables (
  id uuid primary key default gen_random_uuid (),
  created_at timestamptz not null default now (),
  collaboration_id uuid not null
    references public.collaborations (id) on delete cascade,
  type text not null
    check (type in ('Video YouTube', 'Reel IG', 'Story')),
  publish_date date,
  status text not null
    check (
      status in (
        'da girare',
        'in montaggio',
        'approvazione cliente',
        'pubblicato'
      )
    )
);

create table public.financials (
  id uuid primary key default gen_random_uuid (),
  created_at timestamptz not null default now (),
  type text not null
    check (type in ('Entrata YouTube', 'Entrata Sponsor', 'Spesa Materiale')),
  amount numeric not null,
  date date not null,
  collaboration_id uuid references public.collaborations (id) on delete set null
);

-- ---------------------------------------------------------------------------
-- Indici (FK — utili per join e vincoli)
-- ---------------------------------------------------------------------------

create index collaborations_brand_id_idx on public.collaborations (brand_id);
create index deliverables_collaboration_id_idx
  on public.deliverables (collaboration_id);
create index financials_collaboration_id_idx on public.financials (collaboration_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.brands enable row level security;
alter table public.collaborations enable row level security;
alter table public.deliverables enable row level security;
alter table public.financials enable row level security;

-- Fase dev locale: accesso aperto in lettura e inserimento
-- (Rimuovi o restringi in produzione: auth.uid() / ruoli, ecc.)

create policy "brands_dev_select" on public.brands
  for select
  using (true);

create policy "brands_dev_insert" on public.brands
  for insert
  with check (true);

create policy "collaborations_dev_select" on public.collaborations
  for select
  using (true);

create policy "collaborations_dev_insert" on public.collaborations
  for insert
  with check (true);

create policy "deliverables_dev_select" on public.deliverables
  for select
  using (true);

create policy "deliverables_dev_insert" on public.deliverables
  for insert
  with check (true);

create policy "financials_dev_select" on public.financials
  for select
  using (true);

create policy "financials_dev_insert" on public.financials
  for insert
  with check (true);

-- ---------------------------------------------------------------------------
-- Realtime: abbona le tabelle alla publication ufficiale Supabase
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.brands;
alter publication supabase_realtime add table public.collaborations;
alter publication supabase_realtime add table public.deliverables;
alter publication supabase_realtime add table public.financials;
