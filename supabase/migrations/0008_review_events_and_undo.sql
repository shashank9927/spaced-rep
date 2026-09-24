-- RecallCode Product V2. This is deliberately additive: existing cards and
-- logs remain valid, while future reviews record enough state for a safe undo.

do $$
begin
  create type public.review_event_kind as enum ('first_attempt', 'scheduled_review', 'early_review');
exception when duplicate_object then null;
end;
$$;

alter table public.review_logs
  add column if not exists event_kind public.review_event_kind,
  add column if not exists previous_card_state jsonb,
  add column if not exists result_card_state jsonb,
  add column if not exists result_version integer;

-- Legacy rows predate event metadata. They remain in history and are treated
-- as completed attempts/reviews; only newly-created rows are undoable.
update public.review_logs
set event_kind = case when previous_due_at is null then 'first_attempt'::public.review_event_kind else 'scheduled_review'::public.review_event_kind end
where event_kind is null;

alter table public.review_logs
  alter column event_kind set not null;

create table if not exists public.review_reversals (
  id uuid primary key default gen_random_uuid(),
  review_log_id uuid not null unique references public.review_logs(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reversed_at timestamptz not null default now()
);

create index if not exists review_reversals_user_log_idx on public.review_reversals(user_id, review_log_id);
alter table public.review_reversals enable row level security;
drop policy if exists "members read own reversals" on public.review_reversals;
create policy "members read own reversals" on public.review_reversals
  for select using (user_id = auth.uid() and public.is_active_member());
grant select on public.review_reversals to authenticated;

-- The old service wrapper has a distinct signature. Remove it to avoid a
-- second, older mutation path living alongside the new audit-aware operation.
drop function if exists public.submit_review_service(
  uuid, uuid, uuid, public.review_rating, timestamptz, text, text,
  timestamptz, timestamptz, double precision, double precision,
  integer, integer, integer, integer, integer, integer, timestamptz,
  timestamptz, integer
);

create or replace function public.submit_review_service(
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
) returns uuid
language plpgsql security invoker set search_path = public, pg_temp
as $$
declare
  existing_log_id uuid;
  existing_problem_id uuid;
  existing_rating public.review_rating;
  current_version integer;
  result_id uuid;
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

  select id, problem_id, rating into existing_log_id, existing_problem_id, existing_rating
  from public.review_logs where user_id = p_user_id and request_id = p_request_id;
  if existing_log_id is not null then
    if existing_problem_id <> p_problem_id or existing_rating <> p_rating then
      raise exception 'request id conflict' using errcode = '23505';
    end if;
    return existing_log_id;
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
  ) returning id into result_id;
  return result_id;
end;
$$;

create or replace function public.undo_review_service(
  p_user_id uuid,
  p_review_log_id uuid,
  p_expected_version integer
) returns jsonb
language plpgsql security invoker set search_path = public, pg_temp
as $$
declare
  log_row public.review_logs%rowtype;
  current_version integer;
  previous jsonb;
begin
  if current_user <> 'service_role' and coalesce(current_setting('role', true), '') <> 'service_role' then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select l.* into log_row from public.review_logs l
  where l.id = p_review_log_id and l.user_id = p_user_id for update;
  if not found then raise exception 'review not found' using errcode = '42501'; end if;
  if exists (select 1 from public.review_reversals where review_log_id = p_review_log_id) then
    raise exception 'review already undone' using errcode = '40001';
  end if;
  if log_row.created_at < now() - interval '10 minutes' then
    raise exception 'undo window expired' using errcode = '40001';
  end if;
  if exists (
    select 1 from public.review_logs newer
    left join public.review_reversals r on r.review_log_id = newer.id
    where newer.user_id = p_user_id and newer.problem_id = log_row.problem_id
      and newer.created_at > log_row.created_at and r.id is null
  ) then raise exception 'a newer review exists' using errcode = '40001'; end if;

  select version into current_version from public.user_problem_cards
  where user_id = p_user_id and problem_id = log_row.problem_id for update;
  if current_version is distinct from p_expected_version or current_version is distinct from log_row.result_version then
    raise exception 'stale card' using errcode = '40001';
  end if;
  previous := log_row.previous_card_state;
  if previous is null then
    delete from public.user_problem_cards where user_id = p_user_id and problem_id = log_row.problem_id;
  else
    update public.user_problem_cards set
      first_attempted_at = (previous->>'first_attempted_at')::timestamptz,
      due_at = (previous->>'due_at')::timestamptz,
      stability = (previous->>'stability')::double precision,
      difficulty = (previous->>'difficulty')::double precision,
      elapsed_days = (previous->>'elapsed_days')::integer,
      scheduled_days = (previous->>'scheduled_days')::integer,
      learning_steps = (previous->>'learning_steps')::integer,
      reps = (previous->>'reps')::integer,
      lapses = (previous->>'lapses')::integer,
      state = (previous->>'state')::integer,
      last_review_at = nullif(previous->>'last_review_at', '')::timestamptz,
      last_rating = nullif(previous->>'last_rating', '')::public.review_rating,
      version = (previous->>'version')::integer
    where user_id = p_user_id and problem_id = log_row.problem_id;
  end if;
  insert into public.review_reversals (review_log_id, user_id) values (p_review_log_id, p_user_id);
  return jsonb_build_object('problem_id', log_row.problem_id, 'previous_card_state', previous);
end;
$$;

revoke all on function public.submit_review_service(
  uuid, uuid, uuid, public.review_rating, timestamptz, text, text,
  public.review_event_kind, timestamptz, timestamptz, double precision,
  double precision, integer, integer, integer, integer, integer, integer,
  timestamptz, timestamptz, integer, jsonb, jsonb, integer
) from public, anon, authenticated;
grant execute on function public.submit_review_service(
  uuid, uuid, uuid, public.review_rating, timestamptz, text, text,
  public.review_event_kind, timestamptz, timestamptz, double precision,
  double precision, integer, integer, integer, integer, integer, integer,
  timestamptz, timestamptz, integer, jsonb, jsonb, integer
) to service_role;
revoke all on function public.undo_review_service(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.undo_review_service(uuid, uuid, integer) to service_role;
