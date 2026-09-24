-- Ricevute per prestazione occasionale
-- 1) dati di fatturazione sui brand (intestazione del documento)
-- 2) profilo fiscale di chi emette (dati anagrafici, pagamento, firma)
-- 3) registro ricevute emesse (incluse quelle storiche "legacy")

-- ---------------------------------------------------------------------------
-- 1) Brand: dati di fatturazione
-- ---------------------------------------------------------------------------

alter table public.brands add column if not exists billing_name text;
alter table public.brands add column if not exists billing_address text;
alter table public.brands add column if not exists vat_number text;
alter table public.brands add column if not exists billing_extra text;
alter table public.brands add column if not exists receipt_language text not null default 'it';

alter table public.brands drop constraint if exists brands_receipt_language_check;
alter table public.brands add constraint brands_receipt_language_check
  check (receipt_language in ('it', 'en'));

comment on column public.brands.billing_name is 'Ragione sociale da riportare in ricevuta (se vuota si usa name)';
comment on column public.brands.billing_address is 'Indirizzo multi-riga del committente';
comment on column public.brands.vat_number is 'Partita IVA / VAT number del committente';
comment on column public.brands.billing_extra is 'Righe aggiuntive libere (telefono, direzione, codice fiscale…)';
comment on column public.brands.receipt_language is 'Lingua predefinita ricevuta: it | en';

-- ---------------------------------------------------------------------------
-- 2) Profilo fiscale (uno per utente)
-- ---------------------------------------------------------------------------

create table if not exists public.issuer_profiles (
  user_id uuid primary key default auth.uid () references auth.users (id) on delete cascade,
  updated_at timestamptz not null default now (),
  full_name text,
  alias text,
  gender text not null default 'f' check (gender in ('f', 'm')),
  birth_place text,
  birth_date date,
  street text,
  postal_code text,
  city text,
  province text,
  country text,
  tax_code text,
  email text,
  default_place text,
  default_description_it text,
  default_description_en text,
  default_payment_method text not null default 'bank'
    check (default_payment_method in ('bank', 'paypal')),
  bank_name text,
  iban text,
  bic text,
  bank_address text,
  account_holder text,
  paypal_email text,
  signature_data_url text
);

alter table public.issuer_profiles enable row level security;

create policy "issuer_profiles_owner_select" on public.issuer_profiles
  for select using (auth.uid () = user_id);
create policy "issuer_profiles_owner_insert" on public.issuer_profiles
  for insert with check (auth.uid () = user_id);
create policy "issuer_profiles_owner_update" on public.issuer_profiles
  for update using (auth.uid () = user_id) with check (auth.uid () = user_id);
create policy "issuer_profiles_owner_delete" on public.issuer_profiles
  for delete using (auth.uid () = user_id);

-- ---------------------------------------------------------------------------
-- 3) Ricevute
-- ---------------------------------------------------------------------------

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid (),
  created_at timestamptz not null default now (),
  updated_at timestamptz not null default now (),
  user_id uuid not null default auth.uid () references auth.users (id),
  collaboration_id uuid references public.collaborations (id) on delete set null,
  brand_id uuid references public.brands (id) on delete set null,
  number integer not null check (number > 0),
  year integer not null check (year between 2000 and 2100),
  issue_date date not null,
  language text not null default 'it' check (language in ('it', 'en')),
  status text not null default 'emessa'
    check (status in ('emessa', 'pagata', 'annullata')),
  is_legacy boolean not null default false,
  gross_amount numeric(12, 2) not null check (gross_amount > 0),
  withholding_rate numeric(5, 2) not null default 0
    check (withholding_rate >= 0 and withholding_rate < 100),
  withholding_amount numeric(12, 2) not null default 0,
  net_amount numeric(12, 2) not null,
  stamp_duty boolean not null default false,
  description text,
  place text,
  payment_method text not null default 'bank'
    check (payment_method in ('bank', 'paypal')),
  -- Snapshot al momento dell'emissione: il PDF resta identico anche se
  -- anagrafica brand o profilo cambiano in seguito.
  recipient jsonb not null default '{}'::jsonb,
  issuer jsonb not null default '{}'::jsonb,
  payment_details jsonb not null default '{}'::jsonb,
  paid_at date,
  payment_id uuid references public.collaboration_payments (id) on delete set null,
  notes text,
  constraint receipts_user_year_number_unique unique (user_id, year, number)
);

create index if not exists receipts_user_id_idx on public.receipts (user_id);
create index if not exists receipts_collaboration_id_idx on public.receipts (collaboration_id);
create index if not exists receipts_brand_id_idx on public.receipts (brand_id);
create index if not exists receipts_issue_date_idx on public.receipts (issue_date);

comment on column public.receipts.is_legacy is 'Documento emesso fuori dal portale: solo registro, nessun PDF generato';
comment on column public.receipts.payment_id is 'Pagamento collaborazione creato quando la ricevuta è segnata come pagata';

alter table public.receipts enable row level security;

create policy "receipts_owner_select" on public.receipts
  for select using (auth.uid () = user_id);
create policy "receipts_owner_insert" on public.receipts
  for insert with check (auth.uid () = user_id);
create policy "receipts_owner_update" on public.receipts
  for update using (auth.uid () = user_id) with check (auth.uid () = user_id);
create policy "receipts_owner_delete" on public.receipts
  for delete using (auth.uid () = user_id);
