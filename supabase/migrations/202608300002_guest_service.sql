create table if not exists public.anonymous_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text unique not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists public.guest_profiles (
  session_id uuid primary key references public.anonymous_sessions(id) on delete cascade,
  display_name text not null default 'Alex' check (char_length(btrim(display_name)) between 1 and 80),
  arrival_date date,
  housing_type text not null default 'dormitory' check (housing_type in ('dormitory','off_campus')),
  locale text not null default 'en' check (locale in ('en','ko','ja','zh-CN')),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.guest_listings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.anonymous_sessions(id) on delete cascade,
  client_id text,
  seller_name text not null check (char_length(btrim(seller_name)) between 1 and 80),
  item_name text not null check (char_length(btrim(item_name)) between 1 and 120),
  description text not null default '',
  price_krw integer not null check (price_krw > 0 and price_krw <= 100000000),
  category text not null check (category in ('home','kitchen','electronics','bedding')),
  condition text not null check (condition in ('like_new','good','used','clean')),
  pickup_location text not null check (char_length(btrim(pickup_location)) between 1 and 200),
  availability text not null default 'available' check (availability in ('available','reserved')),
  status text not null default 'active' check (status in ('active','reserved','sold','hidden','deleted')),
  image_data_url text,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.guest_reservations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.guest_listings(id) on delete cascade,
  buyer_session_id uuid not null references public.anonymous_sessions(id) on delete cascade,
  buyer_name text not null check (char_length(btrim(buyer_name)) between 1 and 80),
  status text not null default 'active' check (status in ('active','cancelled','completed')),
  pickup_date date not null,
  pickup_start_time time not null,
  pickup_end_time time not null,
  idempotency_key text,
  cancelled_at timestamptz,
  completed_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (pickup_end_time >= pickup_start_time)
);
create unique index if not exists guest_reservations_one_active on public.guest_reservations(listing_id) where status = 'active';
create unique index if not exists guest_reservations_idempotency on public.guest_reservations(buyer_session_id, idempotency_key) where idempotency_key is not null;

create table if not exists public.guest_service_requests (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.anonymous_sessions(id) on delete cascade,
  listing_id uuid references public.guest_listings(id) on delete cascade,
  task_id text,
  service_type text not null check (service_type in ('pickup','delivery','storage','sale','donation','disposal')),
  status text not null default 'not-selected' check (status in ('not-selected','method-selected','consultation-ready','quote-viewed','application-ready','in-progress','completed','cancelled')),
  delivery_method text check (delivery_method is null or delivery_method in ('parcel','courier','undecided')),
  origin text,
  destination text,
  storage_duration text check (storage_duration is null or storage_duration in ('7','30','90')),
  storage_location text check (storage_location is null or storage_location in ('campus','partner')),
  estimated_cost_label text,
  terms_note text,
  idempotency_key text,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists guest_service_requests_unique_key on public.guest_service_requests(session_id, coalesce(listing_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(task_id, ''), service_type) where status <> 'cancelled';
create unique index if not exists guest_service_requests_idempotency on public.guest_service_requests(session_id, idempotency_key) where idempotency_key is not null;

create table if not exists public.guest_lifecycle_progress (
  session_id uuid not null references public.anonymous_sessions(id) on delete cascade,
  task_id text not null check (task_id ~ '^[a-z0-9-]{2,80}$'),
  completed boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (session_id, task_id)
);

create table if not exists public.guest_preferences (
  session_id uuid primary key references public.anonymous_sessions(id) on delete cascade,
  favorite_product_ids jsonb not null default '[]'::jsonb,
  place_favorites jsonb not null default '[]'::jsonb,
  reports jsonb not null default '{}'::jsonb,
  guide_favorites jsonb not null default '[]'::jsonb,
  guide_metadata jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);

create index if not exists guest_listings_visible_idx on public.guest_listings(status, created_at desc) where status in ('active','reserved','sold');
create unique index if not exists guest_listings_client_key on public.guest_listings(session_id, client_id) where client_id is not null;
create index if not exists guest_reservations_buyer_idx on public.guest_reservations(buyer_session_id, updated_at desc);
create index if not exists guest_service_requests_session_idx on public.guest_service_requests(session_id, updated_at desc);

alter table public.anonymous_sessions enable row level security;
alter table public.guest_profiles enable row level security;
alter table public.guest_listings enable row level security;
alter table public.guest_reservations enable row level security;
alter table public.guest_service_requests enable row level security;
alter table public.guest_lifecycle_progress enable row level security;
alter table public.guest_preferences enable row level security;
revoke all on public.anonymous_sessions, public.guest_profiles, public.guest_listings, public.guest_reservations, public.guest_service_requests, public.guest_lifecycle_progress, public.guest_preferences from anon, authenticated;
