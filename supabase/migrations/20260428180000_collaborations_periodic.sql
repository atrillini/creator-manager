-- Collaborazioni periodiche (pacchetti multi-contenuto)
alter table public.collaborations
  add column if not exists is_periodic boolean not null default false;

alter table public.collaborations
  add column if not exists content_count integer;

alter table public.collaborations
  add column if not exists fee_per_content numeric;

comment on column public.collaborations.is_periodic is 'Deal ricorrente / pacchetto: più deliverable pianificati insieme';
comment on column public.collaborations.content_count is 'Numero contenuti previsti (periodico)';
comment on column public.collaborations.fee_per_content is 'Compenso per singolo contenuto (periodico)';
