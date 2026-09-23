import type { CatalogProblem, DueProblem, ProblemSummary } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { getProfile, type Profile } from "@/lib/auth";

function topicsFrom(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry: any) => {
    const topic = entry?.topics ?? entry?.topic;
    return typeof topic?.name === "string" ? [topic.name] : [];
  });
}

function toProblem(value: any): ProblemSummary {
  return {
    id: value.id,
    source_id: value.source_id,
    slug: value.slug,
    title: value.title,
    difficulty: value.difficulty,
    leetcode_url: value.leetcode_url,
    neetcode_url: value.neetcode_url,
    topics: topicsFrom(value.problem_topics),
  };
}

export async function getCatalogProblems(catalogId: Profile["selected_catalog"]): Promise<CatalogProblem[]> {
  const supabase = await createClient();
  const [catalogResult, cardsResult] = await Promise.all([
    supabase
      .from("catalog_problems")
      .select("sort_order, problems(id,source_id,slug,title,difficulty,leetcode_url,neetcode_url,problem_topics(topics(name)))")
      .eq("catalog_slug", catalogId)
      .order("sort_order"),
    supabase.from("user_problem_cards").select("problem_id,due_at,reps,last_review_at"),
  ]);
  const { data, error } = catalogResult;
  if (error) throw error;
  if (cardsResult.error) throw cardsResult.error;
  const cardsByProblem = new Map((cardsResult.data ?? []).map((card: any) => [card.problem_id, card]));
  return (data ?? []).map((row: any) => {
    const card = cardsByProblem.get(row.problems.id);
    return { ...toProblem(row.problems), sort_order: row.sort_order, card: card ?? null };
  });
}

export async function getDueQueue(): Promise<DueProblem[]> {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("user_problem_cards")
    .select("due_at,stability,difficulty,elapsed_days,scheduled_days,learning_steps,reps,lapses,state,last_review_at,version,first_solved_at,problems(id,source_id,slug,title,difficulty,leetcode_url,neetcode_url,problem_topics(topics(name)))")
    .lte("due_at", now)
    .order("due_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    ...toProblem(row.problems),
    card: {
      due: row.due_at,
      due_at: row.due_at,
      stability: Number(row.stability),
      difficulty: Number(row.difficulty),
      elapsed_days: row.elapsed_days,
      scheduled_days: row.scheduled_days,
      learning_steps: row.learning_steps,
      reps: row.reps,
      lapses: row.lapses,
      state: row.state,
      last_review: row.last_review_at,
      version: row.version,
      first_solved_at: row.first_solved_at,
    },
  }));
}

export async function getDashboardData() {
  const profile = await getProfile();
  if (!profile) return null;
  const supabase = await createClient();
  const [due, cards, logs, snapshots] = await Promise.all([
    getDueQueue(),
    supabase.from("user_problem_cards").select("due_at,first_solved_at,last_review_at,reps,problems(title)"),
    supabase.from("review_logs").select("reviewed_at,rating,problem_id,problems(title)").order("reviewed_at", { ascending: false }).limit(180),
    supabase.from("catalog_snapshots").select("version,imported_at,problem_count").order("imported_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const cardRows = cards.data ?? [];
  const logRows = logs.data ?? [];
  return { profile, due, cards: cardRows, logs: logRows as any[], snapshot: snapshots.data };
}

export async function getReviewHistory() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("review_logs")
    .select("id,rating,reviewed_at,note,previous_due_at,next_due_at,scheduled_days,problems(title,difficulty)")
    .order("reviewed_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return data ?? [];
}

export async function getAdminData() {
  const supabase = await createClient();
  const [invites, profiles, snapshots] = await Promise.all([
    supabase.from("allowed_emails").select("email,invited_at,claimed_at,is_active").order("invited_at", { ascending: false }),
    supabase.from("profiles").select("id,email,display_name,role,selected_catalog,created_at"),
    supabase.from("catalog_snapshots").select("version,imported_at,problem_count,source_url").order("imported_at", { ascending: false }).limit(6),
  ]);
  return { invites: invites.data ?? [], profiles: profiles.data ?? [], snapshots: snapshots.data ?? [] };
}
