-- Public-safe support ticket reference codes for user-facing receipts.
alter table public.support_tickets
  add column if not exists reference_code text;

update public.support_tickets
set reference_code = 'TKT-' || upper(substr(replace(id::text, '-', ''), 1, 8))
where reference_code is null;

alter table public.support_tickets
  alter column reference_code set not null;

create unique index if not exists support_tickets_reference_code_idx
  on public.support_tickets(reference_code);
