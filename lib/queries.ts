import { activityForDays, patternStats, queueOrder, reviewStats, type StudyCard } from "@/lib/analytics";
import { getProfile, type Profile } from "@/lib/auth";
import { retrievability } from "@/lib/scheduler";
import { createClient } from "@/lib/supabase/server";
import type { CatalogProblem, DueProblem, FsrsCardState, ProblemSummary, ReviewLogSummary, ReviewRating } from "@/lib/types";

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

function toCardState(row: any): FsrsCardState & { due_at: string; version: number; first_solved_at: string } {
  return {
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
  };
}

async function readLogs(): Promise<ReviewLogSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("review_logs")
    .select("id,problem_id,rating,reviewed_at,note,duration_minutes,pattern_recall,previous_due_at,next_due_at,scheduled_days,problems(title,difficulty)")
    .order("reviewed_at", { ascending: false })
    .limit(5000);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    ...row,
    problems: Array.isArray(row.problems) ? row.problems[0] ?? null : row.problems,
  })) as ReviewLogSummary[];
}

async function readCards() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_problem_cards")
    .select("due_at,stability,difficulty,elapsed_days,scheduled_days,learning_steps,reps,lapses,state,last_review_at,version,first_solved_at,problems(id,source_id,slug,title,difficulty,leetcode_url,neetcode_url,problem_topics(topics(name)))");
  if (error) throw error;
  return data ?? [];
}

function enrichCards(rows: any[], logs: ReviewLogSummary[], now = new Date()): StudyCard[] {
  const latestByProblem = new Map<string, ReviewLogSummary>();
  for (const log of logs) if (!latestByProblem.has(log.problem_id)) latestByProblem.set(log.problem_id, log);
  return rows.flatMap((row) => {
    if (!row.problems) return [];
    const card = toCardState(row);
    const latest = latestByProblem.get(row.problems.id);
    return [{
      ...toProblem(row.problems),
      card,
      retrievability: retrievability(card, now),
      latest_rating: (latest?.rating as ReviewRating | undefined) ?? null,
      latest_note: latest?.note ?? null,
      latest_reviewed_at: latest?.reviewed_at ?? null,
    } satisfies StudyCard];
  });
}

async function studySnapshot(profile?: Profile | null) {
  const activeProfile = profile ?? await getProfile();
  if (!activeProfile) return null;
  const [rows, logs] = await Promise.all([readCards(), readLogs()]);
  const now = new Date();
  return { profile: activeProfile, cards: enrichCards(rows, logs, now), logs, now };
}

export async function getCatalogProblems(catalogId: Profile["selected_catalog"]): Promise<CatalogProblem[]> {
  const supabase = await createClient();
  const [{ data, error }, snapshot] = await Promise.all([
    supabase.from("catalog_problems")
      .select("sort_order,problems(id,source_id,slug,title,difficulty,leetcode_url,neetcode_url,problem_topics(topics(name)))")
      .eq("catalog_slug", catalogId)
      .order("sort_order"),
    studySnapshot(),
  ]);
  if (error) throw error;
  const cardsByProblem = new Map(snapshot?.cards.map((card) => [card.id, card]) ?? []);
  return (data ?? []).flatMap((row: any) => {
    if (!row.problems) return [];
    const card = cardsByProblem.get(row.problems.id);
    return [{
      ...toProblem(row.problems),
      sort_order: row.sort_order,
      card: card ? {
        due_at: card.card.due_at,
        reps: card.card.reps,
        last_review_at: card.card.last_review ?? null,
        stability: card.card.stability,
        lapses: card.card.lapses,
        scheduled_days: card.card.scheduled_days,
        first_solved_at: card.card.first_solved_at,
        retrievability: card.retrievability,
        latest_rating: card.latest_rating,
      } : null,
    }];
  });
}

export async function getDueQueue(): Promise<DueProblem[]> {
  const snapshot = await studySnapshot();
  if (!snapshot) return [];
  return snapshot.cards.filter((card) => new Date(card.card.due_at).getTime() <= snapshot.now.getTime()).sort(queueOrder);
}

export async function getDashboardData() {
  const snapshot = await studySnapshot();
  if (!snapshot) return null;
  const supabase = await createClient();
  const { data: catalogSnapshot } = await supabase.from("catalog_snapshots")
    .select("version,imported_at,problem_count").order("imported_at", { ascending: false }).limit(1).maybeSingle();
  const due = snapshot.cards.filter((card) => new Date(card.card.due_at).getTime() <= snapshot.now.getTime()).sort(queueOrder);
  const upcoming = snapshot.cards.filter((card) => new Date(card.card.due_at).getTime() > snapshot.now.getTime())
    .sort((a, b) => new Date(a.card.due_at).getTime() - new Date(b.card.due_at).getTime());
  return {
    ...snapshot,
    due,
    upcoming,
    stats: reviewStats(snapshot.cards, snapshot.logs, snapshot.profile.timezone, snapshot.now),
    patterns: patternStats(snapshot.cards),
    activity: activityForDays(snapshot.logs, snapshot.profile.timezone, snapshot.now, 35),
    catalogSnapshot,
  };
}

export async function getProblemDetail(problemId: string) {
  const supabase = await createClient();
  const [problemResult, snapshot] = await Promise.all([
    supabase.from("problems").select("id,source_id,slug,title,difficulty,leetcode_url,neetcode_url,problem_topics(topics(name))").eq("id", problemId).maybeSingle(),
    studySnapshot(),
  ]);
  if (problemResult.error) throw problemResult.error;
  if (!problemResult.data || !snapshot) return null;
  const card = snapshot.cards.find((item) => item.id === problemId) ?? null;
  const logs = snapshot.logs.filter((log) => log.problem_id === problemId);
  const timed = logs.filter((log) => log.duration_minutes != null);
  return {
    profile: snapshot.profile,
    problem: toProblem(problemResult.data),
    card,
    logs,
    averageDuration: timed.length ? Math.round(timed.reduce((sum, log) => sum + (log.duration_minutes ?? 0), 0) / timed.length) : null,
  };
}

export async function getPatternsData() {
  const snapshot = await studySnapshot();
  if (!snapshot) return null;
  return { ...snapshot, patterns: patternStats(snapshot.cards), stats: reviewStats(snapshot.cards, snapshot.logs, snapshot.profile.timezone, snapshot.now) };
}

export async function getProgressData() {
  const snapshot = await studySnapshot();
  if (!snapshot) return null;
  return {
    ...snapshot,
    stats: reviewStats(snapshot.cards, snapshot.logs, snapshot.profile.timezone, snapshot.now),
    patterns: patternStats(snapshot.cards),
    activity: activityForDays(snapshot.logs, snapshot.profile.timezone, snapshot.now),
  };
}

export async function getReviewHistory() {
  return readLogs();
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
