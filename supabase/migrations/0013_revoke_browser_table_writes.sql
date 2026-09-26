-- Keep browser roles read-only for application data. RLS scopes reads, while
-- explicit privilege revocation ensures browser sessions cannot mutate
-- cards, logs, profiles, invitations, or shared catalog metadata directly.

revoke insert, update, delete, truncate
  on public.profiles,
     public.allowed_emails,
     public.user_problem_cards,
     public.review_logs,
     public.review_reversals,
     public.catalog_snapshots,
     public.problems,
     public.topics,
     public.problem_topics,
     public.catalogs,
     public.catalog_problems
  from anon, authenticated;

