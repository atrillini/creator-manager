-- Stato intermedio: riprese completate, prima del montaggio
alter table public.deliverables
  drop constraint if exists deliverables_status_check;

alter table public.deliverables
  add constraint deliverables_status_check
  check (
    status in (
      'da girare',
      'girato',
      'in montaggio',
      'approvazione cliente',
      'pubblicato'
    )
  );
