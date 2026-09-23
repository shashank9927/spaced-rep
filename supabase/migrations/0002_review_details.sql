do $$ begin
  create type public.pattern_recall as enum ('no', 'partial', 'yes');
exception when duplicate_object then null;
end $$;

alter table public.review_logs
  add column if not exists duration_minutes smallint check (duration_minutes between 1 and 300),
  add column if not exists pattern_recall public.pattern_recall;

create index if not exists review_logs_user_problem_reviewed_idx
  on public.review_logs (user_id, problem_id, reviewed_at desc);

create or replace function public.submit_review(
  p_problem_id uuid,
  p_request_id uuid,
  p_rating public.review_rating,
  p_reviewed_at timestamptz,
  p_note text,
  p_duration_minutes smallint,
  p_pattern_recall public.pattern_recall,
  p_scheduler_version text,
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
  p_first_solved_at timestamptz,
  p_expected_version integer
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  existing_log_id uuid;
  current_version integer;
  inserted_log_id uuid;
begin
  if auth.uid() is null or not public.is_active_member() then
    raise exception 'not authorized';
  end if;

  select id into existing_log_id from public.review_logs
  where user_id = auth.uid() and request_id = p_request_id;
  if existing_log_id is not null then return existing_log_id; end if;

  select version into current_version from public.user_problem_cards
  where user_id = auth.uid() and problem_id = p_problem_id for update;

  if current_version is null then
    if p_expected_version <> 0 then raise exception 'stale card'; end if;
    insert into public.user_problem_cards (
      user_id, problem_id, first_solved_at, due_at, stability, difficulty, elapsed_days,
      scheduled_days, learning_steps, reps, lapses, state, last_review_at, version
    ) values (
      auth.uid(), p_problem_id, p_first_solved_at, p_next_due_at, p_stability, p_difficulty, p_elapsed_days,
      p_scheduled_days, p_learning_steps, p_reps, p_lapses, p_state, p_last_review_at, 1
    );
  else
    if current_version <> p_expected_version then raise exception 'stale card'; end if;
    update public.user_problem_cards set
      due_at = p_next_due_at, stability = p_stability, difficulty = p_difficulty,
      elapsed_days = p_elapsed_days, scheduled_days = p_scheduled_days, learning_steps = p_learning_steps,
      reps = p_reps, lapses = p_lapses, state = p_state, last_review_at = p_last_review_at,
      version = current_version + 1
    where user_id = auth.uid() and problem_id = p_problem_id;
  end if;

  insert into public.review_logs (
    user_id, problem_id, request_id, rating, reviewed_at, note, duration_minutes, pattern_recall,
    previous_due_at, next_due_at, scheduled_days, scheduler_version
  ) values (
    auth.uid(), p_problem_id, p_request_id, p_rating, p_reviewed_at, nullif(trim(p_note), ''),
    p_duration_minutes, p_pattern_recall, p_previous_due_at, p_next_due_at, p_scheduled_days, p_scheduler_version
  ) returning id into inserted_log_id;

  return inserted_log_id;
end;
$$;

grant execute on function public.submit_review(
  uuid, uuid, public.review_rating, timestamptz, text, smallint, public.pattern_recall, text,
  timestamptz, timestamptz, double precision, double precision, integer, integer, integer,
  integer, integer, integer, timestamptz, timestamptz, integer
) to authenticated;
