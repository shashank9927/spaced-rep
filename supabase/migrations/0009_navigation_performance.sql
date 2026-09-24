-- Read-path performance only. This migration preserves every profile, card,
-- review log, invitation, catalog entry, grant, and ownership boundary.
--
-- `select auth.uid()` and `select public.is_active_member()` become init plans
-- for these RLS policies instead of being re-evaluated for every returned row.

drop policy if exists "members read own profile" on public.profiles;
create policy "members read own profile" on public.profiles
  for select using (
    id = (select auth.uid())
    and (select public.is_active_member())
  );

drop policy if exists "members read snapshots" on public.catalog_snapshots;
drop policy if exists "members read catalog snapshots" on public.catalog_snapshots;
create policy "members read snapshots" on public.catalog_snapshots
  for select using ((select public.is_active_member()));

drop policy if exists "members read problems" on public.problems;
create policy "members read problems" on public.problems
  for select using ((select public.is_active_member()));

drop policy if exists "members read topics" on public.topics;
create policy "members read topics" on public.topics
  for select using ((select public.is_active_member()));

drop policy if exists "members read problem topics" on public.problem_topics;
create policy "members read problem topics" on public.problem_topics
  for select using ((select public.is_active_member()));

drop policy if exists "members read catalogs" on public.catalogs;
create policy "members read catalogs" on public.catalogs
  for select using ((select public.is_active_member()));

drop policy if exists "members read memberships" on public.catalog_problems;
drop policy if exists "members read catalog problems" on public.catalog_problems;
create policy "members read memberships" on public.catalog_problems
  for select using ((select public.is_active_member()));

drop policy if exists "members read own cards" on public.user_problem_cards;
create policy "members read own cards" on public.user_problem_cards
  for select using (
    user_id = (select auth.uid())
    and (select public.is_active_member())
  );

drop policy if exists "members read own logs" on public.review_logs;
create policy "members read own logs" on public.review_logs
  for select using (
    user_id = (select auth.uid())
    and (select public.is_active_member())
  );

drop policy if exists "members read own reversals" on public.review_reversals;
create policy "members read own reversals" on public.review_reversals
  for select using (
    user_id = (select auth.uid())
    and (select public.is_active_member())
  );

-- Existing indexes cover the hot user/date, user/problem, card-due, and
-- catalog-order queries. Measure a production-like query with EXPLAIN before
-- adding any further indexes; redundant indexes slow writes.
