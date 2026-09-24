-- Supabase secret keys authenticate the PostgREST request as service_role,
-- but may not populate request.jwt.claim.role. These invoker wrappers verify
-- the database role, set the trusted claim for the existing definer functions,
-- and keep browser roles unable to call either operation.

create or replace function public.save_profile_settings_service(
  p_user_id uuid,
  p_display_name text,
  p_timezone text,
  p_selected_catalog text,
  p_onboarding_completed boolean default false
) returns void
language plpgsql security invoker set search_path = public, pg_temp
as $$
begin
  if current_user <> 'service_role' and coalesce(current_setting('role', true), '') <> 'service_role' then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform public.save_profile_settings_internal(p_user_id, p_display_name, p_timezone, p_selected_catalog, p_onboarding_completed);
end;
$$;

create or replace function public.submit_review_service(
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
language plpgsql security invoker set search_path = public, pg_temp
as $$
declare result_id uuid;
begin
  if current_user <> 'service_role' and coalesce(current_setting('role', true), '') <> 'service_role' then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  perform set_config('request.jwt.claim.role', 'service_role', true);
  result_id := public.submit_review_internal(
    p_user_id, p_problem_id, p_request_id, p_rating, p_reviewed_at, p_note,
    p_scheduler_version, p_previous_due_at, p_next_due_at, p_stability,
    p_difficulty, p_elapsed_days, p_scheduled_days, p_learning_steps, p_reps,
    p_lapses, p_state, p_last_review_at, p_first_attempted_at, p_expected_version
  );
  return result_id;
end;
$$;

revoke all on function public.save_profile_settings_service(uuid, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.save_profile_settings_service(uuid, text, text, text, boolean) to service_role;
revoke all on function public.submit_review_service(uuid, uuid, uuid, public.review_rating, timestamptz, text, text, timestamptz, timestamptz, double precision, double precision, integer, integer, integer, integer, integer, integer, timestamptz, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.submit_review_service(uuid, uuid, uuid, public.review_rating, timestamptz, text, text, timestamptz, timestamptz, double precision, double precision, integer, integer, integer, integer, integer, integer, timestamptz, timestamptz, integer) to service_role;
