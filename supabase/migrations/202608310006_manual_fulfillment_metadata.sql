-- Internal manual-fulfillment metadata. These fields are intentionally omitted
-- from public session responses except for the user-safe cost/status fields.
alter table public.guest_service_requests
  add column if not exists admin_note text,
  add column if not exists admin_updated_at timestamptz,
  add column if not exists admin_updated_by text;

comment on column public.guest_service_requests.admin_note is 'Internal-only operations note; never expose through public session APIs.';
comment on column public.guest_service_requests.admin_updated_at is 'Timestamp of the latest administrator processing action.';
comment on column public.guest_service_requests.admin_updated_by is 'Non-sensitive operator label for internal audit use.';
