do $$ begin
  create type public.study_weekday as enum ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun');
exception when duplicate_object then null;
end $$;

alter table public.profiles
  add column if not exists new_easy_per_day smallint not null default 0 check (new_easy_per_day between 0 and 10),
  add column if not exists new_medium_per_day smallint not null default 0 check (new_medium_per_day between 0 and 10),
  add column if not exists new_hard_per_day smallint not null default 0 check (new_hard_per_day between 0 and 10),
  add column if not exists study_days public.study_weekday[] not null default array['mon', 'tue', 'wed', 'thu', 'fri']::public.study_weekday[],
  add column if not exists study_plan_configured_at timestamptz;

do $$ begin
  alter table public.profiles add constraint profiles_new_problem_daily_total_check
    check (new_easy_per_day + new_medium_per_day + new_hard_per_day <= 10);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.profiles add constraint profiles_study_days_present_check
    check (coalesce(array_length(study_days, 1), 0) between 1 and 7);
exception when duplicate_object then null;
end $$;

create index if not exists user_problem_cards_user_first_solved_idx
  on public.user_problem_cards (user_id, first_solved_at desc);
