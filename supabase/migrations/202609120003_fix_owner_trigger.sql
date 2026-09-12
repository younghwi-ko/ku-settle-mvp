-- Avoid evaluating marketplace-only seller_id on profiles/lifecycle rows.
create or replace function private.prevent_owner_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_table_name in ('profiles', 'lifecycle_progress')
     and (to_jsonb(new)->>'user_id') is distinct from (to_jsonb(old)->>'user_id') then
    raise exception 'user_id cannot be changed' using errcode = '42501';
  end if;
  if tg_table_name = 'marketplace_items'
     and (to_jsonb(new)->>'seller_id') is distinct from (to_jsonb(old)->>'seller_id') then
    raise exception 'seller_id cannot be changed' using errcode = '42501';
  end if;
  return new;
end $$;
