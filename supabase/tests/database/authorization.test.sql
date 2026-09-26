create extension if not exists pgtap with schema extensions;

begin;
select plan(24);

select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'profiles uses RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.user_problem_cards'::regclass), 'cards use RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.review_logs'::regclass), 'logs use RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.review_reversals'::regclass), 'reversals use RLS');

select is((select count(*) from information_schema.routine_privileges where grantee in ('PUBLIC','anon','authenticated') and routine_schema = 'public' and routine_name = 'submit_review_result_service' and privilege_type = 'EXECUTE'), 0::bigint, 'browser roles cannot execute review RPC');
select is((select count(*) from information_schema.routine_privileges where grantee in ('PUBLIC','anon','authenticated') and routine_schema = 'public' and routine_name = 'undo_review_service' and privilege_type = 'EXECUTE'), 0::bigint, 'browser roles cannot execute undo RPC');
select is((select count(*) from information_schema.routine_privileges where grantee in ('PUBLIC','anon','authenticated') and routine_schema = 'public' and routine_name = 'reset_study_progress_service' and privilege_type = 'EXECUTE'), 0::bigint, 'browser roles cannot execute reset RPC');
select isnt(has_table_privilege('authenticated', 'public.profiles', 'UPDATE'), true, 'members cannot update profiles directly');
select isnt(has_table_privilege('authenticated', 'public.profiles', 'INSERT'), true, 'members cannot create profiles directly');
select isnt(has_table_privilege('authenticated', 'public.user_problem_cards', 'DELETE'), true, 'members cannot delete cards directly');
select isnt(has_table_privilege('authenticated', 'public.user_problem_cards', 'INSERT'), true, 'members cannot create cards directly');
select isnt(has_table_privilege('authenticated', 'public.review_logs', 'INSERT'), true, 'members cannot create review logs directly');
select isnt(has_table_privilege('authenticated', 'public.catalog_problems', 'DELETE'), true, 'members cannot mutate shared catalog data');
select ok((select count(*) = 1 from pg_indexes where schemaname = 'public' and tablename = 'user_problem_cards' and indexdef ilike '%user_id%due_at%'), 'card due index exists');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.local', '', now(), '{"provider":"google","providers":["google"]}', '{}', now(), now()),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@test.local', '', now(), '{"provider":"google","providers":["google"]}', '{}', now(), now()),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@test.local', '', now(), '{"provider":"google","providers":["google"]}', '{}', now(), now()),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'disabled@test.local', '', now(), '{"provider":"google","providers":["google"]}', '{}', now(), now());

insert into public.allowed_emails (email, claimed_by, claimed_at, is_active) values
  ('a@test.local', '10000000-0000-0000-0000-000000000001', now(), true),
  ('b@test.local', '10000000-0000-0000-0000-000000000002', now(), true),
  ('admin@test.local', '10000000-0000-0000-0000-000000000003', now(), true),
  ('disabled@test.local', '10000000-0000-0000-0000-000000000004', now(), false);
insert into public.profiles (id, email, display_name, role, is_active) values
  ('10000000-0000-0000-0000-000000000001', 'a@test.local', 'Member A', 'member', true),
  ('10000000-0000-0000-0000-000000000002', 'b@test.local', 'Member B', 'member', true),
  ('10000000-0000-0000-0000-000000000003', 'admin@test.local', 'Owner', 'admin', true),
  ('10000000-0000-0000-0000-000000000004', 'disabled@test.local', 'Disabled', 'member', false);
insert into public.problems (id, source_id, leetcode_number, slug, title, difficulty, metadata_version, is_active)
values ('20000000-0000-0000-0000-000000000001', 'test-authorization-two-sum', 900000001, 'test-authorization-two-sum', 'Two Sum (authorization test)', 'Easy', 'test', true);
insert into public.user_problem_cards (user_id, problem_id, first_attempted_at, due_at, stability, difficulty, elapsed_days, scheduled_days, learning_steps, reps, lapses, state, last_review_at, last_rating, version)
values
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', now(), now(), 1, 5, 1, 1, 0, 1, 0, 2, now(), 'good', 1),
  ('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', now(), now(), 1, 5, 1, 1, 0, 1, 0, 2, now(), 'hard', 1);
insert into public.review_logs (id, user_id, problem_id, request_id, rating, reviewed_at, note, next_due_at, scheduled_days, scheduler_version, event_kind, result_version)
values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'good', now(), 'private-a', now(), 1, 'test', 'scheduled_review', 1),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', 'hard', now(), 'private-b', now(), 1, 'test', 'scheduled_review', 1);
insert into public.review_reversals (review_log_id, user_id) values ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select is((select count(*) from public.user_problem_cards), 1::bigint, 'member reads only own cards');
select is((select count(*) from public.review_logs), 1::bigint, 'member reads only own logs');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select is((select count(*) from public.user_problem_cards), 0::bigint, 'admin cannot read member cards');
select is((select count(*) from public.review_logs), 0::bigint, 'admin cannot read member notes or logs');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', true);
select is((select count(*) from public.problems), 0::bigint, 'disabled member cannot read catalog data');
reset role;

set local role service_role;
select lives_ok($$select public.reset_study_progress_service('10000000-0000-0000-0000-000000000002')$$, 'service reset succeeds');
select is((select count(*) from public.user_problem_cards where user_id = '10000000-0000-0000-0000-000000000002'), 0::bigint, 'reset deletes member cards');
select is((select count(*) from public.review_logs where user_id = '10000000-0000-0000-0000-000000000002'), 0::bigint, 'reset deletes member logs');
select is((select count(*) from public.review_reversals where user_id = '10000000-0000-0000-0000-000000000002'), 0::bigint, 'reset deletes member reversals');
select lives_ok($$select public.reset_study_progress_service('10000000-0000-0000-0000-000000000002')$$, 'reset is idempotent');
reset role;

select * from finish();
rollback;
