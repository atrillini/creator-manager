-- Data/ora «logica» dell'evento (storia retrodatata); created_at resta invariato
alter table public.collaboration_events
add column if not exists event_at timestamptz;

update public.collaboration_events
set event_at = coalesce(created_at, now())
where event_at is null;

alter table public.collaboration_events
alter column event_at set default now();

alter table public.collaboration_events
alter column event_at set not null;
