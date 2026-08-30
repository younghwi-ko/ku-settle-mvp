create table if not exists public.admin_rate_limit_buckets (
  key_hash text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0)
);

create index if not exists admin_rate_limit_window_idx
  on public.admin_rate_limit_buckets(window_started_at);

alter table public.admin_rate_limit_buckets enable row level security;
revoke all on public.admin_rate_limit_buckets from anon, authenticated;
grant all on public.admin_rate_limit_buckets to service_role;
revoke all on function public.consume_admin_rate_limit(text, integer, integer) from public;
grant execute on function public.consume_admin_rate_limit(text, integer, integer) to service_role;

-- Keep the bucket table bounded without requiring a scheduled job.
create or replace function public.consume_admin_rate_limit(
  p_key_hash text,
  p_window_seconds integer,
  p_limit integer
)
returns table(allowed boolean, retry_after integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_bucket public.admin_rate_limit_buckets%rowtype;
  elapsed_seconds integer;
begin
  delete from public.admin_rate_limit_buckets
  where window_started_at < now() - interval '2 hours'
    and key_hash <> coalesce(p_key_hash, '');

  if p_key_hash is null or length(p_key_hash) <> 64 or p_window_seconds <= 0 or p_limit <= 0 then
    return query select false, p_window_seconds;
    return;
  end if;

  insert into public.admin_rate_limit_buckets(key_hash, window_started_at, request_count)
  values (p_key_hash, now(), 1)
  on conflict (key_hash) do nothing;

  select * into current_bucket
  from public.admin_rate_limit_buckets
  where key_hash = p_key_hash
  for update;

  elapsed_seconds := greatest(0, floor(extract(epoch from (now() - current_bucket.window_started_at)))::integer);
  if elapsed_seconds >= p_window_seconds then
    update public.admin_rate_limit_buckets set window_started_at = now(), request_count = 1 where key_hash = p_key_hash;
    return query select true, 0;
  end if;
  if current_bucket.request_count >= p_limit then
    return query select false, greatest(1, p_window_seconds - elapsed_seconds);
    return;
  end if;
  update public.admin_rate_limit_buckets set request_count = current_bucket.request_count + 1 where key_hash = p_key_hash;
  return query select true, 0;
end;
$$;
