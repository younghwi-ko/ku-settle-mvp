create table if not exists public.admin_place_overrides (
  id uuid primary key default gen_random_uuid(),
  place_key text not null unique,
  base_place_id integer,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','inactive','deleted','needs_confirmation')),
  deleted_at timestamptz,
  deleted_by text,
  deletion_reason text,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists public.admin_guide_overrides (
  id uuid primary key default gen_random_uuid(),
  guide_key text not null unique,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','inactive','deleted','needs_confirmation')),
  deleted_at timestamptz,
  deleted_by text,
  deletion_reason text,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists public.guest_reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.anonymous_sessions(id) on delete set null,
  listing_id uuid references public.guest_listings(id) on delete set null,
  place_key text,
  reason text not null check (char_length(btrim(reason)) between 1 and 80),
  detail text not null default '',
  status text not null default 'new' check (status in ('new','reviewed','resolved','deleted')),
  handled_at timestamptz,
  handled_by text,
  handling_note text,
  deleted_at timestamptz,
  deleted_by text,
  deletion_reason text,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (listing_id is not null or place_key is not null)
);

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor text not null default 'admin',
  resource_type text not null,
  resource_key text not null,
  action text not null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists admin_place_status_idx on public.admin_place_overrides(status, updated_at desc);
create index if not exists admin_guide_status_idx on public.admin_guide_overrides(status, updated_at desc);
create index if not exists guest_reports_status_idx on public.guest_reports(status, updated_at desc);
create index if not exists admin_audit_resource_idx on public.admin_audit_log(resource_type, resource_key, created_at desc);

alter table public.admin_place_overrides enable row level security;
alter table public.admin_guide_overrides enable row level security;
alter table public.guest_reports enable row level security;
alter table public.admin_audit_log enable row level security;
revoke all on public.admin_place_overrides, public.admin_guide_overrides, public.guest_reports, public.admin_audit_log from anon, authenticated;
grant all on public.admin_place_overrides, public.admin_guide_overrides, public.guest_reports, public.admin_audit_log to service_role;
