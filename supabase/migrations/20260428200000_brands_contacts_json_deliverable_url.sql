-- Rubrica contatti strutturata (JSON) su brand; link al contenuto pubblicato su deliverable
alter table public.brands
  add column if not exists contacts_json jsonb not null default '[]'::jsonb;

comment on column public.brands.contacts_json is 'Rubrica: array di {firstName, lastName, email, whatsapp}';

alter table public.deliverables
  add column if not exists content_url text;

comment on column public.deliverables.content_url is 'Link al video/reel/post pubblicato';
