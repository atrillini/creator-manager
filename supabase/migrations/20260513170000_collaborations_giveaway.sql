-- Collaborazioni: supporto giveaway / scambio prodotti
-- Permette di registrare deal in cui il brand invia prodotti invece del compenso.
-- Può convivere con `agreed_fee` per deal misti (cash + merce).

alter table public.collaborations
  add column if not exists is_giveaway boolean not null default false;

alter table public.collaborations
  add column if not exists giveaway_details text;

alter table public.collaborations
  add column if not exists giveaway_value numeric;

comment on column public.collaborations.is_giveaway is
  'Vero se il deal include uno scambio di prodotti/servizi (anche in combinazione col compenso)';
comment on column public.collaborations.giveaway_details is
  'Descrizione testuale di cosa il brand invia (PR package / seeding / gift)';
comment on column public.collaborations.giveaway_value is
  'Valore € stimato dei beni ricevuti (non confluisce nei totali entrate, solo statistico)';
