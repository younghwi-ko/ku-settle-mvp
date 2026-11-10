-- 생성과 종료 모두 상품 → 예약 순서로 잠근다. API의 서비스 역할만 호출한다.
begin;

create or replace function public.create_guest_reservation(
  p_listing_id uuid, p_session_id uuid, p_buyer_name text,
  p_pickup_date date, p_start time, p_end time, p_key text
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  item public.guest_listings;
  reservation public.guest_reservations;
begin
  select * into item from public.guest_listings where id = p_listing_id for update;
  if not found then raise exception 'listing_unavailable'; end if;
  if p_session_id is null or not exists (
    select 1 from public.anonymous_sessions where id = p_session_id and revoked_at is null
  ) then raise exception 'forbidden'; end if;
  if p_key is not null then
    select * into reservation from public.guest_reservations
      where buyer_session_id = p_session_id and idempotency_key = p_key;
    if found then
      if reservation.listing_id <> p_listing_id or reservation.pickup_date <> p_pickup_date
        or reservation.pickup_start_time <> p_start or reservation.pickup_end_time <> p_end
        then raise exception 'idempotency_conflict'; end if;
      if reservation.status = 'active' then
        if item.status not in ('active', 'reserved') then raise exception 'reservation_confirmation_pending'; end if;
        if item.status = 'active' then
          update public.guest_listings set status = 'reserved', availability = 'reserved',
            version = version + 1, updated_at = now() where id = item.id;
        end if;
      end if;
      return jsonb_build_object('reservation', to_jsonb(reservation), 'created', false);
    end if;
  end if;
  if item.session_id = p_session_id then raise exception 'cannot_reserve_own_listing'; end if;
  if item.status <> 'active' then raise exception 'listing_unavailable'; end if;
  if p_buyer_name is null or char_length(btrim(p_buyer_name)) not between 1 and 80
    or p_pickup_date is null or p_start is null or p_end is null or p_end <= p_start
    or char_length(p_key) > 120 then raise exception 'invalid_pickup_schedule'; end if;
  insert into public.guest_reservations (
    listing_id, buyer_session_id, buyer_name, pickup_date, pickup_start_time,
    pickup_end_time, idempotency_key, expires_at
  ) values (item.id, p_session_id, p_buyer_name, p_pickup_date, p_start, p_end, p_key, now() + interval '24 hours')
    returning * into reservation;
  update public.guest_listings set status = 'reserved', availability = 'reserved',
    version = version + 1, updated_at = now() where id = item.id;
  return jsonb_build_object('reservation', to_jsonb(reservation), 'created', true);
end;
$$;

create or replace function public.transition_guest_reservation(
  p_id uuid, p_session_id uuid, p_status text, p_version integer,
  p_mode text, p_reason text default null
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  item_id uuid;
  item public.guest_listings;
  reservation public.guest_reservations;
  was_active boolean;
begin
  select listing_id into item_id from public.guest_reservations where id = p_id;
  if not found then raise exception 'reservation_not_found'; end if;
  select * into item from public.guest_listings where id = item_id for update;
  select * into reservation from public.guest_reservations where id = p_id for update;
  if not found then raise exception 'reservation_not_found'; end if;
  if p_mode = 'user' then
    if p_session_id is null or (p_session_id <> reservation.buyer_session_id and p_session_id <> item.session_id)
      or not exists (select 1 from public.anonymous_sessions where id = p_session_id and revoked_at is null)
      then raise exception 'forbidden'; end if;
    if p_status <> 'cancelled' then raise exception 'invalid_reservation_update'; end if;
    if reservation.status <> 'active' then
      return jsonb_build_object('reservation', to_jsonb(reservation), 'changed', false);
    end if;
  elsif p_mode = 'expiry' then
    if p_status <> 'expired' then raise exception 'invalid_reservation_update'; end if;
    if reservation.status <> 'active' or reservation.expires_at is null or reservation.expires_at > now() then
      return jsonb_build_object('reservation', to_jsonb(reservation), 'changed', false);
    end if;
  elsif p_mode = 'admin' then
    if p_status is null or p_status not in ('active','cancelled','completed','expired','soft_deleted')
      then raise exception 'invalid_reservation_status'; end if;
    if reservation.status = 'soft_deleted' and p_status not in ('soft_deleted','cancelled')
      then raise exception 'reservation_restore_requires_cancelled'; end if;
    if reservation.status not in ('active','soft_deleted') and p_status <> reservation.status and p_status <> 'soft_deleted'
      then raise exception 'reservation_already_closed'; end if;
  else raise exception 'forbidden'; end if;
  if p_version is null or p_version <> reservation.version then raise exception 'version_conflict'; end if;
  if reservation.status = p_status then
    return jsonb_build_object('reservation', to_jsonb(reservation), 'changed', false);
  end if;
  was_active := reservation.status = 'active';
  update public.guest_reservations set status = p_status, version = version + 1, updated_at = now(),
    cancelled_at = case when p_status in ('cancelled','expired','soft_deleted') then now() else null end,
    completed_at = case when p_status = 'completed' then now() else null end,
    deleted_at = case when p_status = 'soft_deleted' then now() else null end,
    deleted_by = case when p_status = 'soft_deleted' then 'admin' else null end,
    deletion_reason = case when p_status = 'soft_deleted' then left(coalesce(p_reason, 'admin cleanup'), 500) else null end
    where id = p_id returning * into reservation;
  -- 과거 예약의 정리는 현재 예약의 상품을 해제하지 않는다. sold/hidden 등도 보존한다.
  if was_active and p_status <> 'active' and item.status = 'reserved' and not exists (
    select 1 from public.guest_reservations where listing_id = item_id and status = 'active'
  ) then
    update public.guest_listings set status = case when p_status = 'completed' then 'sold' else 'active' end,
      availability = 'available', version = version + 1, updated_at = now() where id = item_id;
  end if;
  return jsonb_build_object('reservation', to_jsonb(reservation), 'changed', true);
end;
$$;

revoke all on function public.create_guest_reservation(uuid,uuid,text,date,time,time,text) from public, anon, authenticated;
revoke all on function public.transition_guest_reservation(uuid,uuid,text,integer,text,text) from public, anon, authenticated;
grant execute on function public.create_guest_reservation(uuid,uuid,text,date,time,time,text) to service_role;
grant execute on function public.transition_guest_reservation(uuid,uuid,text,integer,text,text) to service_role;
notify pgrst, 'reload schema';
commit;
