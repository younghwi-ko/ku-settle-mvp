-- Free-launch account bridge.  Anonymous rows remain the source of truth;
-- an account may claim a browser session once and then read it on another device.
alter table public.anonymous_sessions
  add column if not exists account_user_id uuid references auth.users(id) on delete set null,
  add column if not exists claimed_at timestamptz;

create unique index if not exists anonymous_sessions_claimed_once_idx
  on public.anonymous_sessions(id) where account_user_id is not null;
create index if not exists anonymous_sessions_account_idx
  on public.anonymous_sessions(account_user_id, claimed_at desc) where account_user_id is not null;

-- Reservations are expired lazily by the server on read/reserve/admin mutation,
-- so this does not require a paid cron service.
alter table public.guest_reservations
  add column if not exists expires_at timestamptz;
alter table public.guest_reservations
  drop constraint if exists guest_reservations_status_check;
alter table public.guest_reservations
  add constraint guest_reservations_status_check
  check (status in ('active','cancelled','completed','expired','soft_deleted'));
create index if not exists guest_reservations_expiry_idx
  on public.guest_reservations(expires_at) where status = 'active';

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  account_user_id uuid references auth.users(id) on delete cascade,
  session_id uuid references public.anonymous_sessions(id) on delete cascade,
  type text not null check (char_length(type) between 1 and 80),
  title text not null check (char_length(title) between 1 and 160),
  body text not null default '' check (char_length(body) <= 1000),
  resource_type text,
  resource_key text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (account_user_id is not null or session_id is not null)
);
create index if not exists user_notifications_account_idx on public.user_notifications(account_user_id, read_at, created_at desc);
create index if not exists user_notifications_session_idx on public.user_notifications(session_id, read_at, created_at desc);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.anonymous_sessions(id) on delete cascade,
  subject text not null check (char_length(btrim(subject)) between 1 and 160),
  body text not null check (char_length(btrim(body)) between 1 and 3000),
  status text not null default 'open' check (status in ('open','reviewing','resolved','closed','deleted')),
  operator_response text,
  handled_by text,
  handled_at timestamptz,
  deleted_at timestamptz,
  deleted_by text,
  deletion_reason text,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists support_tickets_session_idx on public.support_tickets(session_id, updated_at desc);
create index if not exists support_tickets_status_idx on public.support_tickets(status, updated_at desc);

alter table public.user_notifications enable row level security;
alter table public.support_tickets enable row level security;
revoke all on public.user_notifications, public.support_tickets from anon, authenticated;
grant all on public.user_notifications, public.support_tickets to service_role;

-- Service-role-only RPC: the API authenticates the account bearer token before
-- invoking it. The conditional update prevents two accounts from claiming one
-- anonymous browser session.
create or replace function public.claim_anonymous_session(p_session_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare changed integer;
begin
  update public.anonymous_sessions
     set account_user_id = p_user_id,
         claimed_at = coalesce(claimed_at, now())
   where id = p_session_id
     and (account_user_id is null or account_user_id = p_user_id);
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;
revoke all on function public.claim_anonymous_session(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_anonymous_session(uuid, uuid) to service_role;
