create type public.app_role as enum ('admin', 'member');
create type public.problem_difficulty as enum ('Easy', 'Medium', 'Hard');
create type public.review_rating as enum ('again', 'hard', 'good', 'easy');

create table public.allowed_emails (
  email text primary key check (email = lower(email)),
  invited_by uuid references auth.users(id) on delete set null,
  invited_at timestamptz not null default now(),
  claimed_by uuid unique references auth.users(id) on delete set null,
  claimed_at timestamptz,
  is_active boolean not null default true
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique check (email = lower(email)),
  display_name text,
  timezone text not null default 'UTC',
  selected_catalog text not null default 'neetcode150' check (selected_catalog in ('neetcode150', 'neetcode250', 'allNC')),
  role public.app_role not null default 'member',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.catalog_snapshots (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'neetcode',
  version text not null unique,
  imported_at timestamptz not null default now(),
  source_url text not null,
  problem_count integer not null check (problem_count >= 0)
);

create table public.problems (
  id uuid primary key default gen_random_uuid(),
  source_id text not null unique,
  slug text not null,
  title text not null,
  difficulty public.problem_difficulty not null,
  leetcode_url text,
  neetcode_url text,
  metadata_version text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table public.problem_topics (
  problem_id uuid not null references public.problems(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  primary key (problem_id, topic_id)
);

create table public.catalogs (
  slug text primary key check (slug in ('neetcode150', 'neetcode250', 'allNC')),
  name text not null,
  description text not null,
  snapshot_version text references public.catalog_snapshots(version),
  updated_at timestamptz not null default now()
);

create table public.catalog_problems (
  catalog_slug text not null references public.catalogs(slug) on delete cascade,
  problem_id uuid not null references public.problems(id) on delete cascade,
  sort_order integer not null check (sort_order >= 0),
  primary key (catalog_slug, problem_id),
  unique (catalog_slug, sort_order)
);

create table public.user_problem_cards (
  user_id uuid not null references public.profiles(id) on delete cascade,
  problem_id uuid not null references public.problems(id) on delete cascade,
  first_solved_at timestamptz not null,
  due_at timestamptz not null,
  stability double precision not null,
  difficulty double precision not null,
  elapsed_days integer not null,
  scheduled_days integer not null,
  learning_steps integer not null,
  reps integer not null,
  lapses integer not null,
  state integer not null check (state between 0 and 3),
  last_review_at timestamptz,
  version integer not null default 1,
  primary key (user_id, problem_id)
);

create table public.review_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  problem_id uuid not null references public.problems(id) on delete cascade,
  request_id uuid not null,
  rating public.review_rating not null,
  reviewed_at timestamptz not null,
  note text check (char_length(note) <= 2000),
  previous_due_at timestamptz,
  next_due_at timestamptz not null,
  scheduled_days integer not null,
  scheduler_version text not null,
  created_at timestamptz not null default now(),
  unique (user_id, request_id)
);

create index user_problem_cards_due_idx on public.user_problem_cards (user_id, due_at);
create index review_logs_user_reviewed_idx on public.review_logs (user_id, reviewed_at desc);
create index catalog_problems_catalog_order_idx on public.catalog_problems (catalog_slug, sort_order);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger problems_updated_at before update on public.problems for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active = true
  );
$$;

create or replace function public.is_active_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    join public.allowed_emails a on a.email = p.email
    where p.id = auth.uid() and p.is_active = true and a.is_active = true
  );
$$;

create or replace function public.prevent_profile_privilege_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() = old.id and (
    new.id <> old.id or new.email <> old.email or new.role <> old.role or new.is_active <> old.is_active
  ) then
    raise exception 'Profile identity and access fields cannot be changed by the member';
  end if;
  return new;
end;
$$;
create trigger profiles_protect_access before update on public.profiles for each row execute function public.prevent_profile_privilege_change();

alter table public.allowed_emails enable row level security;
alter table public.profiles enable row level security;
alter table public.catalog_snapshots enable row level security;
alter table public.problems enable row level security;
alter table public.topics enable row level security;
alter table public.problem_topics enable row level security;
alter table public.catalogs enable row level security;
alter table public.catalog_problems enable row level security;
alter table public.user_problem_cards enable row level security;
alter table public.review_logs enable row level security;

create policy "admins manage allowed emails" on public.allowed_emails for all using (public.is_admin()) with check (public.is_admin());
create policy "members read own profile" on public.profiles for select using (id = auth.uid() and public.is_active_member());
create policy "admins read profiles" on public.profiles for select using (public.is_admin());
create policy "members update own profile" on public.profiles for update using (id = auth.uid() and public.is_active_member()) with check (id = auth.uid());
create policy "members read catalog snapshots" on public.catalog_snapshots for select using (public.is_active_member());
create policy "members read problems" on public.problems for select using (public.is_active_member());
create policy "members read topics" on public.topics for select using (public.is_active_member());
create policy "members read problem topics" on public.problem_topics for select using (public.is_active_member());
create policy "members read catalogs" on public.catalogs for select using (public.is_active_member());
create policy "members read catalog problems" on public.catalog_problems for select using (public.is_active_member());
create policy "members read own cards" on public.user_problem_cards for select using (user_id = auth.uid() and public.is_active_member());
create policy "members read own logs" on public.review_logs for select using (user_id = auth.uid() and public.is_active_member());

create or replace function public.submit_review(
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
    user_id, problem_id, request_id, rating, reviewed_at, note, previous_due_at,
    next_due_at, scheduled_days, scheduler_version
  ) values (
    auth.uid(), p_problem_id, p_request_id, p_rating, p_reviewed_at, nullif(trim(p_note), ''),
    p_previous_due_at, p_next_due_at, p_scheduled_days, p_scheduler_version
  ) returning id into inserted_log_id;

  return inserted_log_id;
end;
$$;

grant usage on schema public to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.catalog_snapshots, public.problems, public.topics, public.problem_topics, public.catalogs, public.catalog_problems, public.user_problem_cards, public.review_logs to authenticated;
grant select, insert, update on public.allowed_emails to authenticated;
grant execute on function public.submit_review to authenticated;

insert into public.catalogs (slug, name, description) values
  ('neetcode150', 'NeetCode 150', 'The core interview-practice list.'),
  ('neetcode250', 'NeetCode 250', 'A longer, beginner-friendly progression.'),
  ('allNC', 'NeetCode All', 'Every problem from the imported public catalog snapshot.')
on conflict (slug) do update set name = excluded.name, description = excluded.description;
