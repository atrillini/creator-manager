create table if not exists public.collaboration_payments (
  id uuid primary key default gen_random_uuid (),
  created_at timestamptz not null default now (),
  collaboration_id uuid not null references public.collaborations (id) on delete cascade,
  paid_at date not null default current_date,
  amount numeric not null check (amount > 0),
  note text
);

create index if not exists collaboration_payments_collaboration_id_idx
  on public.collaboration_payments (collaboration_id);
create index if not exists collaboration_payments_paid_at_idx
  on public.collaboration_payments (paid_at);

alter table public.collaboration_payments enable row level security;

create policy "collaboration_payments_dev_select" on public.collaboration_payments
  for select
  using (true);

create policy "collaboration_payments_dev_insert" on public.collaboration_payments
  for insert
  with check (true);

create policy "collaboration_payments_dev_update" on public.collaboration_payments
  for update
  using (true)
  with check (true);

create policy "collaboration_payments_dev_delete" on public.collaboration_payments
  for delete
  using (true);
