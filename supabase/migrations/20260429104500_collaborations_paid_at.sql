alter table public.collaborations
  add column if not exists paid_at timestamptz;

comment on column public.collaborations.paid_at is
  'Quando la collaborazione è stata effettivamente incassata (actual revenue).';
