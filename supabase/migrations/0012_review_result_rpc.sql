-- Return the authoritative card/result from the same transaction that writes
-- a review. This removes the post-save reconciliation query from the server
-- action while preserving idempotency, optimistic locking, and service-only
-- execution. It is additive: the legacy RPC remains available for rollback.

create or replace function public.submit_review_result_service(
  p_user_id uuid,
  p_problem_id uuid,
  p_request_id uuid,
  p_rating public.review_rating,
  p_reviewed_at timestamptz,
  p_note text,
  p_scheduler_version text,
  p_event_kind public.review_event_kind,
  p_previous_due_at timestamptz,
  p_next_due_at timestamptz,
  p_stability double precision,
  p_difficulty double precision,
  p_elapsed_days integer,
  p_scheduled_days integer,
  p_learning_steps integer,
  p_reps integer,
  p_lapses integer,
  p_state integer,
  p_last_review_at timestamptz,
  p_first_attempted_at timestamptz,
  p_expected_version integer,
  p_previous_card_state jsonb,
  p_result_card_state jsonb,
  p_result_version integer
) returns jsonb
language plpgsql security invoker set search_path = public, pg_temp
as $$
declare
  existing_log public.review_logs%rowtype;
  current_version integer;
  saved_log public.review_logs%rowtype;
  saved_card jsonb;
begin
  if current_user <> 'service_role' and coalesce(current_setting('role', true), '') <> 'service_role' then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_user_id is null or p_problem_id is null or p_request_id is null
     or p_event_kind is null or p_next_due_at is null then
    raise exception 'invalid review input' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.profiles p join public.allowed_emails a on a.email = p.email
    where p.id = p_user_id and p.is_active and a.is_active
  ) then raise exception 'not authorized' using errcode = '42501'; end if;
  if not exists (select 1 from public.problems where id = p_problem_id and is_active) then
    raise exception 'problem unavailable' using errcode = '22023';
  end if;
  if p_note is not null and char_length(p_note) > 2000 then
    raise exception 'review note is too long' using errcode = '22023';
  end if;
  if p_scheduled_days < 0 or p_scheduled_days > 365 or p_state not between 0 and 3
     or p_elapsed_days < 0 or p_learning_steps < 0 or p_reps < 0 or p_lapses < 0
     or p_stability is null or p_stability < 0 or p_stability <> p_stability
     or p_difficulty is null or p_difficulty < 0 or p_difficulty > 10 or p_difficulty <> p_difficulty
     or p_result_version < 1 then
    raise exception 'invalid review state' using errcode = '22023';
  end if;

  select l.* into existing_log
  from public.review_logs l where l.user_id = p_user_id and l.request_id = p_request_id;
  if existing_log.id is not null then
    if existing_log.problem_id <> p_problem_id
       or existing_log.rating <> p_rating
       or coalesce(btrim(existing_log.note), '') <> coalesce(btrim(p_note), '') then
      raise exception 'request id conflict' using errcode = '23505';
    end if;
    select coalesce(existing_log.result_card_state, to_jsonb(c)) into saved_card
    from public.user_problem_cards c
    where c.user_id = p_user_id and c.problem_id = p_problem_id;
    return jsonb_build_object(
      'review_log_id', existing_log.id,
      'event_kind', coalesce(existing_log.event_kind::text, 'scheduled_review'),
      'next_due', existing_log.next_due_at,
      'reviewed_at', existing_log.reviewed_at,
      'previous_interval_days', coalesce((existing_log.previous_card_state ->> 'scheduled_days')::integer, 0),
      'new_interval_days', existing_log.scheduled_days,
      'note', existing_log.note,
      'card', saved_card,
      'idempotent', true
    );
  end if;

  select version into current_version from public.user_problem_cards
  where user_id = p_user_id and problem_id = p_problem_id for update;
  if current_version is null then
    if p_expected_version <> 0 or p_event_kind <> 'first_attempt' then
      raise exception 'stale card' using errcode = '40001';
    end if;
    insert into public.user_problem_cards (
      user_id, problem_id, first_attempted_at, due_at, stability, difficulty,
      elapsed_days, scheduled_days, learning_steps, reps, lapses, state,
      last_review_at, last_rating, version
    ) values (
      p_user_id, p_problem_id, p_first_attempted_at, p_next_due_at, p_stability,
      p_difficulty, p_elapsed_days, p_scheduled_days, p_learning_steps, p_reps,
      p_lapses, p_state, p_last_review_at, p_rating, p_result_version
    );
  else
    if current_version <> p_expected_version or p_event_kind = 'first_attempt' then
      raise exception 'stale card' using errcode = '40001';
    end if;
    update public.user_problem_cards set
      due_at = p_next_due_at, stability = p_stability, difficulty = p_difficulty,
      elapsed_days = p_elapsed_days, scheduled_days = p_scheduled_days,
      learning_steps = p_learning_steps, reps = p_reps, lapses = p_lapses,
      state = p_state, last_review_at = p_last_review_at, last_rating = p_rating,
      version = p_result_version
    where user_id = p_user_id and problem_id = p_problem_id;
  end if;

  insert into public.review_logs (
    user_id, problem_id, request_id, rating, reviewed_at, note, event_kind,
    previous_due_at, next_due_at, scheduled_days, scheduler_version,
    previous_card_state, result_card_state, result_version
  ) values (
    p_user_id, p_problem_id, p_request_id, p_rating, p_reviewed_at,
    nullif(btrim(p_note), ''), p_event_kind, p_previous_due_at, p_next_due_at,
    p_scheduled_days, p_scheduler_version, p_previous_card_state,
    p_result_card_state, p_result_version
  ) returning * into saved_log;

  return jsonb_build_object(
    'review_log_id', saved_log.id,
    'event_kind', saved_log.event_kind::text,
    'next_due', saved_log.next_due_at,
    'reviewed_at', saved_log.reviewed_at,
    'previous_interval_days', coalesce((p_previous_card_state ->> 'scheduled_days')::integer, 0),
    'new_interval_days', saved_log.scheduled_days,
    'note', saved_log.note,
    'card', p_result_card_state,
    'idempotent', false
  );
end;
$$;

revoke all on function public.submit_review_result_service(
  uuid, uuid, uuid, public.review_rating, timestamptz, text, text,
  public.review_event_kind, timestamptz, timestamptz, double precision,
  double precision, integer, integer, integer, integer, integer, integer,
  timestamptz, timestamptz, integer, jsonb, jsonb, integer
) from public, anon, authenticated;
grant execute on function public.submit_review_result_service(
  uuid, uuid, uuid, public.review_rating, timestamptz, text, text,
  public.review_event_kind, timestamptz, timestamptz, double precision,
  double precision, integer, integer, integer, integer, integer, integer,
  timestamptz, timestamptz, integer, jsonb, jsonb, integer
) to service_role;
