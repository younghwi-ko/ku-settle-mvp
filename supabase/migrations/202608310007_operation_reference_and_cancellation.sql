alter table public.guest_service_requests
  add column if not exists reference_code text,
  add column if not exists admin_cancel_reason text;

update public.guest_service_requests
set reference_code = 'REQ-' || upper(substr(replace(id::text, '-', ''), 1, 10))
where reference_code is null;

alter table public.guest_service_requests
  alter column reference_code set not null;

create unique index if not exists guest_service_requests_reference_code_key
  on public.guest_service_requests(reference_code);

comment on column public.guest_service_requests.reference_code is 'Public-safe service request reference shown to the anonymous requester.';
comment on column public.guest_service_requests.admin_cancel_reason is 'Internal cancellation reason; never expose through public session APIs.';
