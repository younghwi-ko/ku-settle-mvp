create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or (char_length(btrim(display_name)) between 1 and 80)),
  preferred_language text not null default 'en' check (preferred_language in ('en','ko','ja','zh-CN')),
  expected_arrival_date date,
  housing_type text check (housing_type is null or housing_type in ('dormitory','off_campus')),
  onboarding_completed boolean not null default false,
  guest_data_imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lifecycle_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id text not null check (task_id ~ '^[a-z0-9-]{2,80}$'),
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, task_id),
  check ((completed and completed_at is not null) or (not completed and completed_at is null))
);

create table public.marketplace_items (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id) on delete cascade,
  seller_display_name text not null check (char_length(btrim(seller_display_name)) between 1 and 80),
  item_name text not null check (char_length(btrim(item_name)) between 1 and 120),
  price_krw integer not null check (price_krw > 0 and price_krw <= 100000000),
  category text not null check (category in ('home','kitchen','electronics','bedding')),
  condition text not null check (condition in ('like_new','good','used','clean')),
  pickup_location text not null check (char_length(btrim(pickup_location)) between 1 and 200),
  availability text not null check (availability in ('available','reserved')),
  status text not null default 'active' check (status in ('active','sold','hidden','deleted')),
  guest_source_id text check (guest_source_id is null or char_length(guest_source_id) between 1 and 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.marketplace_items add constraint marketplace_items_guest_source_unique unique (seller_id, guest_source_id);
create index marketplace_items_visible_idx on public.marketplace_items(status, created_at desc) where status in ('active','sold');

create or replace function private.set_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

create trigger profiles_updated_at before update on public.profiles for each row execute function private.set_updated_at();
create trigger lifecycle_progress_updated_at before update on public.lifecycle_progress for each row execute function private.set_updated_at();
create trigger marketplace_items_updated_at before update on public.marketplace_items for each row execute function private.set_updated_at();

create or replace function private.set_progress_completed_at() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.completed then new.completed_at = coalesce(old.completed_at, now()); else new.completed_at = null; end if;
  return new;
end $$;
create trigger lifecycle_progress_completed_at before insert or update of completed on public.lifecycle_progress for each row execute function private.set_progress_completed_at();

create or replace function private.prevent_owner_change() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'profiles' and new.user_id <> old.user_id then raise exception 'user_id cannot be changed' using errcode = '42501'; end if;
  if tg_table_name = 'lifecycle_progress' and new.user_id <> old.user_id then raise exception 'user_id cannot be changed' using errcode = '42501'; end if;
  if tg_table_name = 'marketplace_items' and new.seller_id <> old.seller_id then raise exception 'seller_id cannot be changed' using errcode = '42501'; end if;
  return new;
end $$;
create trigger profiles_owner_immutable before update on public.profiles for each row execute function private.prevent_owner_change();
create trigger lifecycle_owner_immutable before update on public.lifecycle_progress for each row execute function private.prevent_owner_change();
create trigger marketplace_owner_immutable before update on public.marketplace_items for each row execute function private.prevent_owner_change();

create or replace function private.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
declare locale text;
begin
  locale := coalesce(new.raw_user_meta_data->>'preferred_language', 'en');
  if locale not in ('en','ko','ja','zh-CN') then locale := 'en'; end if;
  insert into public.profiles(user_id, preferred_language) values (new.id, locale) on conflict (user_id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();

create or replace function private.before_user_created(event jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare email text; normalized text;
begin
  email := event->'user'->>'email'; normalized := lower(btrim(coalesce(email, '')));
  if normalized !~ '^[^@[:space:]]+@korea[.]ac[.]kr$' or array_length(string_to_array(normalized, '@'), 1) <> 2 then
    return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'Only @korea.ac.kr email addresses are allowed.'));
  end if;
  return '{}'::jsonb;
end $$;
grant usage on schema private to supabase_auth_admin;
grant execute on function private.before_user_created(jsonb) to supabase_auth_admin;
revoke execute on function private.before_user_created(jsonb) from public, anon, authenticated;

create or replace function private.is_active_auth_user() returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists(select 1 from auth.users where id = (select auth.uid()));
$$;
revoke execute on function private.is_active_auth_user() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_active_auth_user() to authenticated;

alter table public.profiles enable row level security;
alter table public.lifecycle_progress enable row level security;
alter table public.marketplace_items enable row level security;

revoke all on public.profiles, public.lifecycle_progress, public.marketplace_items from anon;
revoke all on public.profiles, public.lifecycle_progress, public.marketplace_items from authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.lifecycle_progress to authenticated;
grant select, insert, update, delete on public.marketplace_items to authenticated;

create policy profiles_select_own on public.profiles for select to authenticated using (private.is_active_auth_user() and (select auth.uid()) = user_id);
create policy profiles_update_own on public.profiles for update to authenticated using (private.is_active_auth_user() and (select auth.uid()) = user_id) with check (private.is_active_auth_user() and (select auth.uid()) = user_id);

create policy progress_select_own on public.lifecycle_progress for select to authenticated using (private.is_active_auth_user() and (select auth.uid()) = user_id);
create policy progress_insert_own on public.lifecycle_progress for insert to authenticated with check (private.is_active_auth_user() and (select auth.uid()) = user_id);
create policy progress_update_own on public.lifecycle_progress for update to authenticated using (private.is_active_auth_user() and (select auth.uid()) = user_id) with check (private.is_active_auth_user() and (select auth.uid()) = user_id);
create policy progress_delete_own on public.lifecycle_progress for delete to authenticated using (private.is_active_auth_user() and (select auth.uid()) = user_id);

create policy marketplace_select_visible on public.marketplace_items for select to authenticated using (private.is_active_auth_user() and (status in ('active','sold') or seller_id = (select auth.uid())));
create policy marketplace_insert_own on public.marketplace_items for insert to authenticated with check (private.is_active_auth_user() and seller_id = (select auth.uid()) and status = 'active');
create policy marketplace_update_own on public.marketplace_items for update to authenticated using (private.is_active_auth_user() and seller_id = (select auth.uid())) with check (private.is_active_auth_user() and seller_id = (select auth.uid()));
create policy marketplace_delete_own on public.marketplace_items for delete to authenticated using (private.is_active_auth_user() and seller_id = (select auth.uid()));
