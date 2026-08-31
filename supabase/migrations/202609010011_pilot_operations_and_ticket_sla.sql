-- Two-week pilot operating data.  These records are configured by an
-- administrator and are intentionally separate from static local-guide data.
create table if not exists public.admin_operation_rules (
  id uuid primary key default gen_random_uuid(),
  operation_type text not null check (operation_type in ('delivery', 'storage')),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  address text not null check (char_length(btrim(address)) between 1 and 500),
  cost_label text not null check (char_length(btrim(cost_label)) between 1 and 160),
  rules text not null check (char_length(btrim(rules)) between 1 and 3000),
  duration_days integer[] not null default '{}'::integer[],
  source_url text,
  checked_at date not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'inactive', 'deleted')),
  deleted_at timestamptz,
  deleted_by text,
  deletion_reason text,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(duration_days) <= 12)
);
create index if not exists admin_operation_rules_type_status_idx on public.admin_operation_rules(operation_type, status, updated_at desc);
alter table public.admin_operation_rules enable row level security;
revoke all on public.admin_operation_rules from anon, authenticated;
grant all on public.admin_operation_rules to service_role;

alter table public.support_tickets
  add column if not exists first_response_due_at timestamptz,
  add column if not exists first_response_at timestamptz;
create index if not exists support_tickets_first_response_due_idx
  on public.support_tickets(first_response_due_at) where first_response_at is null and status not in ('closed', 'deleted');
