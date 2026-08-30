-- Allow administrators to hide test/operational records without destroying history.
alter table public.guest_reservations
  drop constraint if exists guest_reservations_status_check;
alter table public.guest_reservations
  add constraint guest_reservations_status_check
  check (status in ('active', 'cancelled', 'completed', 'soft_deleted'));
alter table public.guest_reservations
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by text,
  add column if not exists deletion_reason text;

alter table public.guest_service_requests
  drop constraint if exists guest_service_requests_status_check;
alter table public.guest_service_requests
  add constraint guest_service_requests_status_check
  check (status in ('not-selected','method-selected','consultation-ready','quote-viewed','application-ready','in-progress','completed','cancelled','soft_deleted'));
alter table public.guest_service_requests
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by text,
  add column if not exists deletion_reason text;

drop index if exists public.guest_service_requests_unique_key;
create unique index if not exists guest_service_requests_unique_key
  on public.guest_service_requests(session_id, coalesce(listing_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(task_id, ''), service_type)
  where status not in ('cancelled', 'soft_deleted');
