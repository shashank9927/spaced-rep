create extension if not exists pgtap with schema extensions;

begin;
select plan(12);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'reviewer@test.local', '', now(), '{"provider":"google","providers":["google"]}', '{}', now(), now()),
  ('50000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other@test.local', '', now(), '{"provider":"google","providers":["google"]}', '{}', now(), now());
insert into public.allowed_emails (email, claimed_by, claimed_at, is_active) values
  ('reviewer@test.local', '50000000-0000-0000-0000-000000000001', now(), true),
  ('other@test.local', '50000000-0000-0000-0000-000000000002', now(), true);
insert into public.profiles (id, email, display_name, is_active) values
  ('50000000-0000-0000-0000-000000000001', 'reviewer@test.local', 'Reviewer', true),
  ('50000000-0000-0000-0000-000000000002', 'other@test.local', 'Other User', true);
insert into public.problems (id, source_id, leetcode_number, slug, title, difficulty, metadata_version, is_active)
values ('60000000-0000-0000-0000-000000000001', 'test-review-two-sum', 900000002, 'test-review-two-sum', 'Two Sum (review transaction test)', 'Easy', 'test', true);

create function pg_temp.submit_test(p_request uuid, p_rating public.review_rating, p_note text, p_expected integer, p_version integer)
returns jsonb language sql as $$
  select public.submit_review_result_service(
    '50000000-0000-0000-0000-000000000001',
    '60000000-0000-0000-0000-000000000001',
    p_request, p_rating, now(), p_note, 'test', 'first_attempt', null,
    now() + interval '3 days', 3, 5, 0, 3, 0, 1, 0, 2, now(), now(),
    p_expected, null,
    jsonb_build_object(
      'first_attempted_at', now(), 'due_at', now() + interval '3 days',
      'stability', 3, 'difficulty', 5, 'elapsed_days', 0,
      'scheduled_days', 3, 'learning_steps', 0, 'reps', 1, 'lapses', 0,
      'state', 2, 'last_review_at', now(), 'last_rating', p_rating, 'version', p_version
    ), p_version
  );
$$;

set local role service_role;
select lives_ok($$select pg_temp.submit_test('70000000-0000-0000-0000-000000000001', 'good', 'remember hash map', 0, 1)$$, 'first attempt is atomic');
select is((select count(*) from public.review_logs where request_id = '70000000-0000-0000-0000-000000000001'), 1::bigint, 'first attempt writes one immutable log');
select is((select version from public.user_problem_cards where user_id = '50000000-0000-0000-0000-000000000001'), 1, 'first attempt writes card version one');
select lives_ok($$select pg_temp.submit_test('70000000-0000-0000-0000-000000000001', 'good', 'remember hash map', 0, 1)$$, 'exact retry returns original result');
select is((select count(*) from public.review_logs where request_id = '70000000-0000-0000-0000-000000000001'), 1::bigint, 'exact retry does not duplicate logs');
select throws_ok($$select pg_temp.submit_test('70000000-0000-0000-0000-000000000001', 'good', 'changed note', 0, 1)$$, '23505', 'request id conflict', 'request id cannot be reused with another note');
select throws_ok($$select pg_temp.submit_test('70000000-0000-0000-0000-000000000002', 'hard', null, 0, 1)$$, '40001', 'stale card', 'concurrent first attempt cannot overwrite a card');
select lives_ok($$select public.undo_review_service('50000000-0000-0000-0000-000000000001', (select id from public.review_logs where request_id = '70000000-0000-0000-0000-000000000001'), 1)$$, 'first attempt can be undone');
select is((select count(*) from public.user_problem_cards where user_id = '50000000-0000-0000-0000-000000000001'), 0::bigint, 'undo first attempt removes its card');
select is((select count(*) from public.review_reversals where user_id = '50000000-0000-0000-0000-000000000001'), 1::bigint, 'undo records a reversal');
select throws_ok($$select public.undo_review_service('50000000-0000-0000-0000-000000000001', (select id from public.review_logs where request_id = '70000000-0000-0000-0000-000000000001'), 1)$$, '40001', 'review already undone', 'the same review cannot be undone twice');
select throws_ok($$select public.undo_review_service('50000000-0000-0000-0000-000000000002', (select id from public.review_logs where request_id = '70000000-0000-0000-0000-000000000001'), 1)$$, '42501', 'review not found', 'another user cannot undo the review');
reset role;

select * from finish();
rollback;
