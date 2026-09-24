-- Manual-learning queue correction. Safe after either the pre-greenfield schema
-- or the original 0004 reset: no user cards or review logs are touched.

alter table public.profiles drop constraint if exists profiles_new_problem_daily_total_check;
alter table public.profiles drop constraint if exists profiles_study_days_present_check;
alter table public.profiles drop column if exists new_easy_per_day;
alter table public.profiles drop column if exists new_medium_per_day;
alter table public.profiles drop column if exists new_hard_per_day;
alter table public.profiles drop column if exists study_days;
alter table public.profiles drop column if exists study_plan_configured_at;

drop type if exists public.study_weekday;
