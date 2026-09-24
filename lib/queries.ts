import { cache } from "react";
import { activityForDays, patternStats, queueOrder, reviewStats, type StudyCard } from "@/lib/analytics";
import { getProfile, type Profile } from "@/lib/auth";
import { buildScheduleData, getTodayPlan } from "@/lib/study-plan";
import { retrievability } from "@/lib/scheduler";
import { createClient } from "@/lib/supabase/server";
import { leetcodeNumberFromSourceId } from "@/lib/utils";
import type { CatalogProblem, DueProblem, FsrsCardState, ProblemSummary, ReviewLogSummary, ReviewRating, StudyPlanPreferences } from "@/lib/types";

const CARD_SELECT = "due_at,stability,difficulty,elapsed_days,scheduled_days,learning_steps,reps,lapses,state,last_review_at,last_rating,version,first_attempted_at,problems(id,source_id,leetcode_number,slug,title,difficulty,leetcode_url,neetcode_url,problem_topics(topics(name)))";
const LOG_SELECT = "id,problem_id,rating,reviewed_at,note,previous_due_at,next_due_at,scheduled_days,problems(title,difficulty,source_id,leetcode_number)";

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
    leetcodeNumber: value.leetcode_number ?? leetcodeNumberFromSourceId(value.source_id),
    slug: value.slug,
    title: value.title,
    difficulty: value.difficulty,
    leetcode_url: value.leetcode_url,
    neetcode_url: value.neetcode_url,
    topics: topicsFrom(value.problem_topics),
  };
}

function toCardState(row: any): FsrsCardState & { due_at: string; version: number; first_attempted_at: string } {
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
    first_attempted_at: row.first_attempted_at,
  };
}

function mapLogs(rows: any[]): ReviewLogSummary[] {
  return rows.map((row) => ({
    ...row,
    problems: Array.isArray(row.problems) ? row.problems[0] ?? null : row.problems,
  })) as ReviewLogSummary[];
}

const readCards = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("user_problem_cards").select(CARD_SELECT);
  if (error) throw error;
  return data ?? [];
});

// Analytics only needs a bounded look-back window. Detailed history has its own
// per-problem query, so normal navigation never fetches a user's whole log.
const readRecentLogs = cache(async (): Promise<ReviewLogSummary[]> => {
  const supabase = await createClient();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 366);
  const { data, error } = await supabase.from("review_logs").select(LOG_SELECT).gte("reviewed_at", since.toISOString()).order("reviewed_at", { ascending: false }).limit(800);
  if (error) throw error;
  return mapLogs(data ?? []);
});

async function readLogsForProblem(problemId: string): Promise<ReviewLogSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("review_logs").select(LOG_SELECT).eq("problem_id", problemId).order("reviewed_at", { ascending: false }).limit(250);
  if (error) throw error;
  return mapLogs(data ?? []);
}

async function readLogsInRange(start: string, endExclusive: string): Promise<ReviewLogSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("review_logs").select(LOG_SELECT).gte("reviewed_at", start).lt("reviewed_at", endExclusive).order("reviewed_at", { ascending: false });
  if (error) throw error;
  return mapLogs(data ?? []);
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
      latest_rating: (latest?.rating as ReviewRating | undefined) ?? (row.last_rating as ReviewRating | undefined) ?? null,
      latest_note: latest?.note ?? null,
      latest_reviewed_at: latest?.reviewed_at ?? null,
    } satisfies StudyCard];
  });
}

const studySnapshot = cache(async () => {
  const profile = await getProfile();
  if (!profile) return null;
  const [rows, logs] = await Promise.all([readCards(), readRecentLogs()]);
  const now = new Date();
  return { profile, cards: enrichCards(rows, logs, now), logs, now };
});

const cardSnapshot = cache(async () => {
  const profile = await getProfile();
  if (!profile) return null;
  const rows = await readCards();
  const now = new Date();
  return { profile, rows, cards: enrichCards(rows, [], now), now };
});

const catalogRows = cache(async (catalogId: Profile["selected_catalog"]) => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("catalog_problems")
    .select("sort_order,problems(id,source_id,leetcode_number,slug,title,difficulty,leetcode_url,neetcode_url,problem_topics(topics(name)))")
    .eq("catalog_slug", catalogId)
    .order("sort_order");
  if (error) throw error;
  return data ?? [];
});

async function catalogProblemsForSnapshot(catalogId: Profile["selected_catalog"], cards: StudyCard[]) {
  const data = await catalogRows(catalogId);
  const cardsByProblem = new Map(cards.map((card) => [card.id, card]));
  return data.flatMap((row: any) => {
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
        first_attempted_at: card.card.first_attempted_at,
        retrievability: card.retrievability,
        latest_rating: card.latest_rating,
      } : null,
    } satisfies CatalogProblem];
  });
}

export async function getCatalogProblems(catalogId: Profile["selected_catalog"]): Promise<CatalogProblem[]> {
  const snapshot = await cardSnapshot();
  return catalogProblemsForSnapshot(catalogId, snapshot?.cards ?? []);
}

export async function getDueQueue(): Promise<DueProblem[]> {
  const snapshot = await cardSnapshot();
  if (!snapshot) return [];
  return snapshot.cards.filter((card) => new Date(card.card.due_at).getTime() <= snapshot.now.getTime()).sort(queueOrder);
}

function preferencesFrom(profile: Profile): StudyPlanPreferences {
  return {
    easyPerDay: profile.new_easy_per_day ?? 0,
    mediumPerDay: profile.new_medium_per_day ?? 0,
    hardPerDay: profile.new_hard_per_day ?? 0,
    studyDays: profile.study_days ?? ["mon", "tue", "wed", "thu", "fri"],
    configured: Boolean(profile.study_plan_configured_at),
  };
}

export async function getTodayData() {
  const snapshot = await studySnapshot();
  if (!snapshot) return null;
  const catalogProblems = await catalogProblemsForSnapshot(snapshot.profile.selected_catalog, snapshot.cards);
  const due = snapshot.cards.filter((card) => new Date(card.card.due_at).getTime() <= snapshot.now.getTime()).sort(queueOrder);
  const upcoming = snapshot.cards.filter((card) => new Date(card.card.due_at).getTime() > snapshot.now.getTime())
    .sort((a, b) => new Date(a.card.due_at).getTime() - new Date(b.card.due_at).getTime());
  const preferences = preferencesFrom(snapshot.profile);
  const todayPlan = getTodayPlan({ preferences, cards: snapshot.cards, catalogProblems, now: snapshot.now, timezone: snapshot.profile.timezone });
  return {
    ...snapshot,
    due,
    upcoming,
    stats: reviewStats(snapshot.cards, snapshot.logs, snapshot.profile.timezone, snapshot.now, snapshot.profile.study_days),
    todayPlan,
  };
}

// Backward-compatible name while pages move to the smaller Today model.
export const getDashboardData = getTodayData;

export async function getScheduleData(month: string) {
  const snapshot = await cardSnapshot();
  if (!snapshot) return null;
  const catalogProblems = await catalogProblemsForSnapshot(snapshot.profile.selected_catalog, snapshot.cards);
  const [year, calendarMonth] = month.split("-").map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(calendarMonth) || calendarMonth < 1 || calendarMonth > 12) throw new Error("Invalid schedule month.");
  const first = new Date(Date.UTC(year, calendarMonth - 1, 1));
  const gridStart = new Date(first);
  gridStart.setUTCDate(gridStart.getUTCDate() - ((gridStart.getUTCDay() + 6) % 7));
  // Expand both edges by one day so a profile-local day is never truncated by UTC.
  const logStart = new Date(gridStart.getTime() - 86_400_000);
  const logEnd = new Date(gridStart.getTime() + 43 * 86_400_000);
  const logs = await readLogsInRange(logStart.toISOString(), logEnd.toISOString());
  return buildScheduleData({ month, preferences: preferencesFrom(snapshot.profile), cards: snapshot.cards, catalogProblems, logs, now: snapshot.now, timezone: snapshot.profile.timezone, selectedCatalog: snapshot.profile.selected_catalog });
}

export async function getProblemDetail(problemId: string) {
  const supabase = await createClient();
  const [problemResult, snapshot, logs] = await Promise.all([
    supabase.from("problems").select("id,source_id,leetcode_number,slug,title,difficulty,leetcode_url,neetcode_url,problem_topics(topics(name))").eq("id", problemId).maybeSingle(),
    cardSnapshot(),
    readLogsForProblem(problemId),
  ]);
  if (problemResult.error) throw problemResult.error;
  if (!problemResult.data || !snapshot) return null;
  const card = enrichCards(snapshot.rows, logs, snapshot.now).find((item) => item.id === problemId) ?? null;
  return {
    profile: snapshot.profile,
    problem: toProblem(problemResult.data),
    card,
    logs,
  };
}

export async function getPatternsData() {
  const snapshot = await studySnapshot();
  if (!snapshot) return null;
  return { ...snapshot, patterns: patternStats(snapshot.cards), stats: reviewStats(snapshot.cards, snapshot.logs, snapshot.profile.timezone, snapshot.now, snapshot.profile.study_days) };
}

export async function getProgressData() {
  const snapshot = await studySnapshot();
  if (!snapshot) return null;
  return {
    ...snapshot,
    stats: reviewStats(snapshot.cards, snapshot.logs, snapshot.profile.timezone, snapshot.now, snapshot.profile.study_days),
    patterns: patternStats(snapshot.cards),
    activity: activityForDays(snapshot.logs, snapshot.profile.timezone, snapshot.now),
  };
}

export async function getReviewHistory() {
  return readRecentLogs();
}

export async function getAdminData() {
  const supabase = await createClient();
  const [invites, snapshots] = await Promise.all([
    supabase.from("allowed_emails").select("email,invited_at,claimed_at,is_active").order("invited_at", { ascending: false }),
    supabase.from("catalog_snapshots").select("version,imported_at,problem_count,source_url").order("imported_at", { ascending: false }).limit(6),
  ]);
  return { invites: invites.data ?? [], snapshots: snapshots.data ?? [] };
}
