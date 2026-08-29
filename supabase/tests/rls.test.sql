begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

select is(private.before_user_created('{"user":{"email":"student@korea.ac.kr"}}'::jsonb), '{}'::jsonb, 'exact KU email is allowed');
select isnt(private.before_user_created('{"user":{"email":"student@sub.korea.ac.kr"}}'::jsonb), '{}'::jsonb, 'subdomain is rejected');

insert into auth.users(instance_id,id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','authenticated','authenticated','a@korea.ac.kr',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','authenticated','authenticated','b@korea.ac.kr',now(),'{}','{}',now(),now());

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}',true);
select is((select count(*)::integer from public.profiles), 1, 'A sees only own profile');
select lives_ok($$update public.profiles set display_name='A' where user_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$, 'A updates own profile');
select is((select count(*)::integer from public.profiles where user_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 0, 'A cannot see B profile');
select lives_ok($$insert into public.lifecycle_progress(user_id,task_id,completed) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','arc',true)$$, 'A inserts own progress');
select throws_ok($$insert into public.lifecycle_progress(user_id,task_id,completed) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','arc',true)$$, '42501', null, 'A cannot insert B progress');
select lives_ok($$insert into public.marketplace_items(seller_id,seller_display_name,item_name,price_krw,category,condition,pickup_location,availability) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','A','Lamp',8000,'home','good','KU gate','available')$$, 'A inserts own item');
select throws_ok($$insert into public.marketplace_items(seller_id,seller_display_name,item_name,price_krw,category,condition,pickup_location,availability) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','B','Lamp',8000,'home','good','KU gate','available')$$, '42501', null, 'seller spoof is rejected');
select is((select count(*)::integer from public.marketplace_items where seller_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 1, 'A sees own item');

reset role;
set local role anon;
select throws_ok($$insert into public.lifecycle_progress(user_id,task_id,completed) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','bank',true)$$, '42501', null, 'anon insert denied');
select throws_ok($$delete from public.marketplace_items$$, '42501', null, 'anon delete denied');

reset role;
delete from auth.users where id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select is((select count(*)::integer from public.marketplace_items where seller_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 0, 'account deletion cascades listings');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}',true);
select is((select count(*)::integer from public.profiles), 0, 'deleted user JWT cannot read exposed data');
select * from finish();
rollback;
