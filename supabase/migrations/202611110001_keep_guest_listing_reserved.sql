begin;

set local lock_timeout = '5s';

create function private.keep_guest_listing_reserved()
returns trigger language plpgsql volatile security invoker set search_path = '' as $$
begin
  -- Reservation creation and transitions hold the same listing row lock.
  if exists (
    select 1 from public.guest_reservations
    where listing_id = new.id and status = 'active'
  ) then
    new.status := 'reserved';
    new.availability := 'reserved';
  end if;
  return new;
end;
$$;

revoke all on function private.keep_guest_listing_reserved() from public, anon, authenticated;

create trigger keep_guest_listing_reserved
before update of status on public.guest_listings
for each row when (new.status = 'active')
execute function private.keep_guest_listing_reserved();

commit;
