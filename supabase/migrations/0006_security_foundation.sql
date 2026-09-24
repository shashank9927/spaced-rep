-- Security foundation: browser roles can read their permitted data, but all
-- state-changing application operations go through trusted server actions.

create or replace function public.save_profile_settings_internal(
  p_user_id uuid,
  p_display_name text,
  p_timezone text,
  p_selected_catalog text,
  p_onboarding_completed boolean default false
) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), nullif(current_setting('role', true), ''), '') <> 'service_role' then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.profiles p
    join public.allowed_emails a on a.email = p.email
    where p.id = p_user_id and p.is_active and a.is_active
  ) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_display_name is null or char_length(btrim(p_display_name)) not between 2 and 60 then
    raise exception 'invalid display name' using errcode = '22023';
  end if;
  if p_timezone is null or not exists (select 1 from pg_timezone_names where name = p_timezone) then
    raise exception 'invalid timezone' using errcode = '22023';
  end if;
  if p_selected_catalog not in ('neetcode150', 'neetcode250', 'allNC') then
    raise exception 'invalid catalog' using errcode = '22023';
  end if;
  if not exists (select 1 from public.catalogs where slug = p_selected_catalog) then
    raise exception 'catalog unavailable' using errcode = '22023';
  end if;
  update public.profiles
  set display_name = btrim(p_display_name),
      timezone = p_timezone,
      selected_catalog = p_selected_catalog,
      onboarding_completed_at = case when p_onboarding_completed then coalesce(onboarding_completed_at, now()) else onboarding_completed_at end,
      updated_at = now()
  where id = p_user_id and is_active;
  if not found then raise exception 'not authorized' using errcode = '42501'; end if;
end;
$$;

create or replace function public.submit_review_internal(
  p_user_id uuid,
  p_problem_id uuid,
  p_request_id uuid,
  p_rating public.review_rating,
  p_reviewed_at timestamptz,
  p_note text,
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
  p_first_attempted_at timestamptz,
  p_expected_version integer
) returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  existing_log_id uuid;
  existing_problem_id uuid;
  existing_rating public.review_rating;
  current_version integer;
  inserted_log_id uuid;
begin
  if coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), nullif(current_setting('role', true), ''), '') <> 'service_role' then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_user_id is null or p_problem_id is null or p_request_id is null then
    raise exception 'invalid review identity' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.profiles p
    join public.allowed_emails a on a.email = p.email
    where p.id = p_user_id and p.is_active and a.is_active
  ) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if not exists (select 1 from public.problems where id = p_problem_id and is_active) then
    raise exception 'problem unavailable' using errcode = '22023';
  end if;
  if p_note is not null and char_length(p_note) > 2000 then
    raise exception 'review note is too long' using errcode = '22023';
  end if;
  if p_reviewed_at is null or p_reviewed_at > now() + interval '5 minutes' or p_reviewed_at < now() - interval '10 minutes' then
    raise exception 'invalid review timestamp' using errcode = '22023';
  end if;
  if p_next_due_at is null or p_scheduled_days < 0 or p_scheduled_days > 365 or p_state not between 0 and 3
    or p_elapsed_days < 0 or p_learning_steps < 0 or p_reps < 0 or p_lapses < 0
    or p_stability is null or p_stability < 0 or p_stability <> p_stability
    or p_difficulty is null or p_difficulty < 0 or p_difficulty > 10 or p_difficulty <> p_difficulty then
    raise exception 'invalid review state' using errcode = '22023';
  end if;
  if (select count(*) from public.review_logs where user_id = p_user_id and reviewed_at > now() - interval '1 hour') >= 300 then
    raise exception 'review rate limit exceeded' using errcode = 'P0001';
  end if;

  select id, problem_id, rating into existing_log_id, existing_problem_id, existing_rating
  from public.review_logs where user_id = p_user_id and request_id = p_request_id;
  if existing_log_id is not null then
    if existing_problem_id <> p_problem_id or existing_rating <> p_rating then
      raise exception 'request id conflict' using errcode = '23505';
    end if;
    return existing_log_id;
  end if;

  select version into current_version
  from public.user_problem_cards
  where user_id = p_user_id and problem_id = p_problem_id
  for update;
  if current_version is null then
    if p_expected_version <> 0 then raise exception 'stale card' using errcode = '40001'; end if;
    insert into public.user_problem_cards (
      user_id, problem_id, first_attempted_at, due_at, stability, difficulty,
      elapsed_days, scheduled_days, learning_steps, reps, lapses, state,
      last_review_at, last_rating, version
    ) values (
      p_user_id, p_problem_id, coalesce(p_first_attempted_at, p_reviewed_at), p_next_due_at,
      p_stability, p_difficulty, p_elapsed_days, p_scheduled_days, p_learning_steps,
      p_reps, p_lapses, p_state, p_last_review_at, p_rating, 1
    );
  else
    if current_version <> p_expected_version then raise exception 'stale card' using errcode = '40001'; end if;
    update public.user_problem_cards set
      due_at = p_next_due_at, stability = p_stability, difficulty = p_difficulty,
      elapsed_days = p_elapsed_days, scheduled_days = p_scheduled_days,
      learning_steps = p_learning_steps, reps = p_reps, lapses = p_lapses,
      state = p_state, last_review_at = p_last_review_at, last_rating = p_rating,
      version = current_version + 1
    where user_id = p_user_id and problem_id = p_problem_id;
  end if;

  insert into public.review_logs (
    user_id, problem_id, request_id, rating, reviewed_at, note, previous_due_at,
    next_due_at, scheduled_days, scheduler_version
  ) values (
    p_user_id, p_problem_id, p_request_id, p_rating, p_reviewed_at,
    nullif(btrim(p_note), ''), p_previous_due_at, p_next_due_at,
    p_scheduled_days, p_scheduler_version
  ) returning id into inserted_log_id;
  return inserted_log_id;
end;
$$;

-- The server client is the only caller of these operations.
grant usage on schema public to service_role;
revoke all on function public.save_profile_settings_internal(uuid, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.save_profile_settings_internal(uuid, text, text, text, boolean) to service_role;
revoke all on function public.submit_review_internal(uuid, uuid, uuid, public.review_rating, timestamptz, text, text, timestamptz, timestamptz, double precision, double precision, integer, integer, integer, integer, integer, integer, timestamptz, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.submit_review_internal(uuid, uuid, uuid, public.review_rating, timestamptz, text, text, timestamptz, timestamptz, double precision, double precision, integer, integer, integer, integer, integer, integer, timestamptz, timestamptz, integer) to service_role;

-- Browser users no longer write access-control or profile fields directly.
revoke insert, update, delete on public.allowed_emails from anon, authenticated;
revoke update on public.profiles from anon, authenticated;
revoke select on public.allowed_emails from anon, authenticated;

-- Keep policy helpers usable by authenticated RLS evaluation, but not callable anonymously.
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_active_member() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.is_active_member() to authenticated, service_role;

-- Remove browser access to every legacy client-callable review overload.
do $$
declare r record;
begin
  for r in select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'submit_review'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.signature);
  end loop;
end;
$$;

do $$
begin
  alter table public.problems add constraint problems_title_length check (char_length(title) between 1 and 200);
exception when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.problems add constraint problems_external_urls check (
    (leetcode_url is null or leetcode_url ~ '^https://(www\.)?leetcode\.com/') and
    (neetcode_url is null or neetcode_url ~ '^https://(www\.)?neetcode\.io/')
  );
exception when duplicate_object then null;
end;
$$;
