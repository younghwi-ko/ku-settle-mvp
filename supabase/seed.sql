-- Local-only deterministic users for RLS exploration. Never deploy this file as production data.
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'local-a@korea.ac.kr', now(), '{"provider":"email","providers":["email"]}', '{"preferred_language":"en"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'local-b@korea.ac.kr', now(), '{"provider":"email","providers":["email"]}', '{"preferred_language":"ko"}', now(), now())
on conflict (id) do nothing;

update public.profiles set display_name = 'Local Student A', housing_type = 'dormitory', onboarding_completed = true where user_id = '11111111-1111-1111-1111-111111111111';
update public.profiles set display_name = 'Local Student B', housing_type = 'off_campus', onboarding_completed = true where user_id = '22222222-2222-2222-2222-222222222222';
