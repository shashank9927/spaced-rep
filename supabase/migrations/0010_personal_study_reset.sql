-- Permanently clears one member's private learning data without touching their
-- profile, invitation, authentication identity, or shared catalog metadata.

create or replace function public.reset_study_progress_service(
  p_user_id uuid
) returns jsonb
language plpgsql security invoker set search_path = public, pg_temp
as $$
declare
  reversal_count integer := 0;
  log_count integer := 0;
  card_count integer := 0;
begin
  if current_user <> 'service_role' and coalesce(current_setting('role', true), '') <> 'service_role' then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_user_id is null or not exists (
    select 1
    from public.profiles p
    join public.allowed_emails a on a.email = p.email
    where p.id = p_user_id and p.is_active and a.is_active
  ) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  -- Serialize simultaneous reset requests for the same member. A review
  -- deliberately submitted after this transaction begins new study history.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  -- Reversals reference review logs with ON DELETE RESTRICT, so their rows
  -- must be removed before the immutable logs and cards.
  delete from public.review_reversals where user_id = p_user_id;
  get diagnostics reversal_count = row_count;

  delete from public.review_logs where user_id = p_user_id;
  get diagnostics log_count = row_count;

  delete from public.user_problem_cards where user_id = p_user_id;
  get diagnostics card_count = row_count;

  return jsonb_build_object(
    'reversals_deleted', reversal_count,
    'logs_deleted', log_count,
    'cards_deleted', card_count
  );
end;
$$;

revoke all on function public.reset_study_progress_service(uuid) from public, anon, authenticated;
grant execute on function public.reset_study_progress_service(uuid) to service_role;
