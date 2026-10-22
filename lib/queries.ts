import "server-only";

import { cache } from "react";
import { connection } from "next/server";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import { activityForWeeks, activitySummaryForDays, attentionProblems, attentionReason, median, patternSignals, previousDateKey, progressSummary, queueOrder, recallOutcomesForWeeks, reviewLoadForCards, weekStartKey, type StudyCard } from "@/lib/analytics";
import { getProfile, type Profile } from "@/lib/auth";
import { measure } from "@/lib/performance";
import { buildScheduleAgenda, buildScheduleData, isDueOnOrBeforeLocalDay } from "@/lib/study-plan";
import { retrievability, SCHEDULER_PRESENTATION } from "@/lib/scheduler";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { leetcodeNumberFromSourceId, localDateKey } from "@/lib/utils";
import { isAllowedExternalUrl } from "@/lib/security";
import { decodeHistoryCursor, encodeHistoryCursor, readAllPages } from "@/lib/pagination";
import type { CatalogId, CatalogProblemSummary, DueProblem, DueQueuePayload, FsrsCardState, ProblemDeckPayload, ProblemSummary, ProgressPayload, ReviewLogSummary, ReviewRating, ScheduleAgendaPayload, TodayPayload } from "@/lib/types";

const CARD_SELECT = "due_at,stability,difficulty,elapsed_days,scheduled_days,learning_steps,reps,lapses,state,last_review_at,last_rating,version,first_attempted_at,problems(id,source_id,leetcode_number,slug,title,difficulty,leetcode_url,neetcode_url,problem_topics(position,is_primary,topics(name)))";
const CARD_SUMMARY_SELECT = "problem_id,due_at,reps,last_review_at,last_rating,lapses,scheduled_days,first_attempted_at";
const ANALYTICS_LOG_SELECT = "id,problem_id,rating,reviewed_at,previous_due_at,next_due_at,scheduled_days,event_kind,result_version,review_reversals(reversed_at)";
const HISTORY_LOG_SELECT = "id,problem_id,rating,reviewed_at,note,previous_due_at,next_due_at,scheduled_days,event_kind,result_version,review_reversals(reversed_at),problems(title,difficulty,source_id,leetcode_number)";
const SCHEDULE_LOG_SELECT = "id,problem_id,reviewed_at,previous_due_at,event_kind,review_reversals(reversed_at),problems(title,difficulty,source_id,leetcode_number)";
const CATALOG_SELECT = "sort_order,problems(id,source_id,leetcode_number,title,difficulty,problem_topics(position,is_primary,topics(name)))";

type CardRow = Record<string, any>;

function topicsFrom(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry: any) => {
    const topic = entry?.topics ?? entry?.topic;
    const resolved = Array.isArray(topic) ? topic[0] : topic;
    return typeof resolved?.name === "string" ? [resolved.name] : [];
  });
}

function primaryTopicFrom(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  const primary = value.find((entry: any) => entry?.is_primary);
  const topic = primary?.topics ?? primary?.topic;
  const resolved = Array.isArray(topic) ? topic[0] : topic;
  return typeof resolved?.name === "string" ? resolved.name : topicsFrom(value)[0] ?? null;
}

function approvedLink(value: unknown, host: string) {
  if (typeof value !== "string" || !isAllowedExternalUrl(value)) return null;
  try {
    const hostname = new URL(value).hostname;
    return hostname === host || hostname.endsWith(`.${host}`) ? value : null;
  } catch {
    return null;
  }
}

function toProblem(value: any): ProblemSummary {
  return {
    id: value.id,
    source_id: value.source_id,
    leetcodeNumber: value.leetcode_number ?? leetcodeNumberFromSourceId(value.source_id),
    slug: value.slug ?? value.source_id,
    title: value.title,
    difficulty: value.difficulty,
    leetcode_url: approvedLink(value.leetcode_url, "leetcode.com"),
    neetcode_url: approvedLink(value.neetcode_url, "neetcode.io"),
    topics: topicsFrom(value.problem_topics),
    primaryTopic: primaryTopicFrom(value.problem_topics),
  };
}

function toCatalogProblem(value: any): Omit<CatalogProblemSummary, "sort_order" | "card"> {
  return {
    id: value.id,
    leetcodeNumber: value.leetcode_number ?? leetcodeNumberFromSourceId(value.source_id),
    title: value.title,
    difficulty: value.difficulty,
    topics: topicsFrom(value.problem_topics),
    primaryTopic: primaryTopicFrom(value.problem_topics),
  };
}

function toCardState(row: CardRow): FsrsCardState & { due_at: string; version: number; first_attempted_at: string } {
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
  return rows.map((row) => {
    const reversal = Array.isArray(row.review_reversals) ? row.review_reversals[0] : row.review_reversals;
    return { ...row, event_kind: row.event_kind ?? (row.previous_due_at ? "scheduled_review" : "first_attempt"), reversed_at: reversal?.reversed_at ?? null, problems: Array.isArray(row.problems) ? row.problems[0] ?? null : row.problems };
  }) as ReviewLogSummary[];
}

function enrichCards(rows: CardRow[], logs: ReviewLogSummary[] = [], now = new Date()): StudyCard[] {
  const latestByProblem = new Map<string, ReviewLogSummary>();
  for (const log of logs) if (!latestByProblem.has(log.problem_id)) latestByProblem.set(log.problem_id, log);
  return rows.flatMap((row) => {
    if (!row.problems) return [];
    const card = toCardState(row);
    const latest = latestByProblem.get(row.problems.id);
    return [{
      ...toProblem(row.problems), card, retrievability: retrievability(card, now),
      latest_rating: (latest?.rating as ReviewRating | undefined) ?? (row.last_rating as ReviewRating | undefined) ?? null,
      latest_note: latest?.note ?? null,
      latest_reviewed_at: latest?.reviewed_at ?? row.last_review_at ?? null,
    } satisfies StudyCard];
  });
}

const readStudyCards = cache(async () => {
  const supabase = await createClient();
  return readAllPages<any>((offset, size) => measure("cards.read", () => supabase.from("user_problem_cards").select(CARD_SELECT).order("problem_id").range(offset, offset + size - 1)));
});

const readCardSummaries = cache(async () => {
  const supabase = await createClient();
  return readAllPages<any>((offset, size) => measure("cards.summary", () => supabase.from("user_problem_cards").select(CARD_SUMMARY_SELECT).order("problem_id").range(offset, offset + size - 1)));
});

const readAnalyticsLogs = cache(async (since: string) => {
  const supabase = await createClient();
  const rows = await readAllPages<any>((offset, size) => measure("logs.analytics", () => supabase.from("review_logs").select(ANALYTICS_LOG_SELECT).gte("reviewed_at", since).order("reviewed_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + size - 1)));
  return mapLogs(rows);
});

const readLogsForProblem = cache(async (problemId: string, before?: string) => {
  const supabase = await createClient();
  const active: ReviewLogSummary[] = [];
  let cursor = decodeHistoryCursor(before);
  // Reversed events remain in the audit table but must not consume an active
  // history slot. Pull enough rows to return a full, active page whenever one
  // exists without loading the user's entire history.
  while (active.length < 21) {
    let query = supabase.from("review_logs").select(HISTORY_LOG_SELECT).eq("problem_id", problemId).order("reviewed_at", { ascending: false }).order("id", { ascending: false }).limit(100);
    if (cursor?.id) query = query.or(`reviewed_at.lt.${cursor.reviewedAt},and(reviewed_at.eq.${cursor.reviewedAt},id.lt.${cursor.id})`);
    else if (cursor?.reviewedAt) query = query.lt("reviewed_at", cursor.reviewedAt);
    const { data, error } = await measure("logs.problem", () => query, { pageSize: 25 });
    if (error) throw error;
    const page = data ?? [];
    active.push(...mapLogs(page).filter((log) => !log.reversed_at));
    if (page.length < 100) break;
    const last = page.at(-1);
    if (!last) break;
    cursor = { reviewedAt: last.reviewed_at, id: last.id };
  }
  return active;
});

const readLogsInRange = cache(async (start: string, endExclusive: string) => {
  const supabase = await createClient();
  // Schedule needs only event timing and a display label. Never ship private
  // notes or full review history just to paint calendar entries.
  const data = await readAllPages<any>((offset, size) => measure("logs.range", () => supabase.from("review_logs").select(SCHEDULE_LOG_SELECT).gte("reviewed_at", start).lt("reviewed_at", endExclusive).order("reviewed_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + size - 1)));
  return mapLogs(data ?? []);
});

function cachedCatalogRows(catalogId: CatalogId) {
  return unstable_cache(async () => {
    const supabase = createAdminClient();
    return readAllPages<any>((offset, size) => measure("catalog.shared", () => supabase.from("catalog_problems").select(CATALOG_SELECT).eq("catalog_slug", catalogId).order("sort_order").order("problem_id").range(offset, offset + size - 1), { catalogId }));
  }, ["catalog-summary", catalogId], { revalidate: 21_600, tags: [`catalog:${catalogId}`] })();
}

const catalogRows = cache(cachedCatalogRows);

function todayStats(cards: StudyCard[], logs: ReviewLogSummary[], timezone: string, now: Date) {
  const start = weekStartKey(now, timezone);
  const today = localDateKey(now, timezone);
  const thisWeek = logs.filter((log) => { const key = localDateKey(new Date(log.reviewed_at), timezone); return !log.reversed_at && key >= start && key <= today; });
  return {
    firstAttemptsThisWeek: thisWeek.filter((log) => log.event_kind === "first_attempt").length,
    scheduledReviewsThisWeek: thisWeek.filter((log) => log.event_kind === "scheduled_review").length,
    earlyReviewsThisWeek: thisWeek.filter((log) => log.event_kind === "early_review").length,
    activeProblemCount: cards.length,
    medianIntervalDays: median(cards.map((card) => card.card.scheduled_days).filter((days) => days > 0)),
  };
}

export async function getTodayData(): Promise<TodayPayload | null> {
  // User cards/logs are deliberately uncached private data. Mark the boundary
  // explicitly so Cache Components streams this work below the page fallback.
  await connection();
  const now = new Date();
  const profile = await getProfile();
  if (!profile) return null;
  const [rows, logs] = await Promise.all([readStudyCards(), readAnalyticsLogs(new Date(now.getTime() - 8 * 86_400_000).toISOString())]);
  const cards = enrichCards(rows, [], now);
  const due = cards.filter((card) => isDueOnOrBeforeLocalDay(card.card.due_at, now, profile.timezone)).sort(queueOrder);
  const upcoming = cards.filter((card) => !isDueOnOrBeforeLocalDay(card.card.due_at, now, profile.timezone)).sort((a, b) => new Date(a.card.due_at).getTime() - new Date(b.card.due_at).getTime()).slice(0, 3);
  return { timezone: profile.timezone, todayKey: localDateKey(now, profile.timezone), dueReviews: due, upcomingReviews: upcoming, ...todayStats(cards, logs, profile.timezone, now) };
}

export const getDashboardData = getTodayData;

export async function getCatalogProblems(catalogId: CatalogId): Promise<ProblemDeckPayload> {
  await connection();
  const profile = await getProfile();
  if (!profile) return { catalogId, todayKey: localDateKey(new Date(), "UTC"), problems: [], activeCount: 0, dueCount: 0 };
  const [rows, cardRows] = await Promise.all([catalogRows(catalogId), readCardSummaries()]);
  const cards = new Map(cardRows.map((card: any) => [card.problem_id, card]));
  const problems = rows.flatMap((row: any) => {
    if (!row.problems) return [];
    const card = cards.get(row.problems.id);
    return [{ ...toCatalogProblem(row.problems), sort_order: row.sort_order, card: card ? {
      due_at: card.due_at, reps: card.reps, last_review_at: card.last_review_at, lapses: card.lapses,
      scheduled_days: card.scheduled_days, first_attempted_at: card.first_attempted_at, latest_rating: card.last_rating,
    } : null } satisfies CatalogProblemSummary];
  });
  const now = new Date();
  const dueCount = problems.filter((problem) => problem.card && isDueOnOrBeforeLocalDay(problem.card.due_at, now, profile.timezone)).length;
  return { catalogId, todayKey: localDateKey(new Date(), profile.timezone), problems, activeCount: problems.filter((problem) => problem.card).length, dueCount };
}

export async function getDueQueue(): Promise<DueQueuePayload> {
  await connection();
  const profile = await getProfile();
  const now = new Date();
  if (!profile) return { timezone: "UTC", todayKey: localDateKey(now, "UTC"), problems: [] };
  const rows = await readStudyCards();
  return { timezone: profile.timezone, todayKey: localDateKey(now, profile.timezone), problems: enrichCards(rows, [], now).filter((card) => isDueOnOrBeforeLocalDay(card.card.due_at, now, profile.timezone)).sort(queueOrder) };
}

function localMonth(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en", { timeZone: timezone, year: "numeric", month: "2-digit" }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${year}-${month}`;
}

export async function getScheduleAgendaData(): Promise<ScheduleAgendaPayload | null> {
  await connection();
  const now = new Date();
  const profile = await getProfile();
  if (!profile) return null;
  const [rows, logs] = await Promise.all([
    readStudyCards(),
    readLogsInRange(new Date(now.getTime() - 2 * 86_400_000).toISOString(), new Date(now.getTime() + 16 * 86_400_000).toISOString()),
  ]);
  const data = buildScheduleAgenda({ cards: enrichCards(rows, [], now), logs, now, timezone: profile.timezone });
  const [year, numericMonth] = data.todayKey.slice(0, 7).split("-").map(Number);
  const max = new Date(Date.UTC(year, numericMonth + 11, 1));
  return { ...data, maxMonth: `${max.getUTCFullYear()}-${String(max.getUTCMonth() + 1).padStart(2, "0")}` };
}

export async function getScheduleData(month: string) {
  await connection();
  const [year, calendarMonth] = month.split("-").map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(calendarMonth) || calendarMonth < 1 || calendarMonth > 12) throw new Error("Invalid schedule month.");
  const first = new Date(Date.UTC(year, calendarMonth - 1, 1));
  const gridStart = new Date(first);
  gridStart.setUTCDate(gridStart.getUTCDate() - ((gridStart.getUTCDay() + 6) % 7));
  const now = new Date();
  const profile = await getProfile();
  if (!profile) return null;
  const [rows, logs] = await Promise.all([
    readStudyCards(),
    readLogsInRange(new Date(gridStart.getTime() - 86_400_000).toISOString(), new Date(gridStart.getTime() + 43 * 86_400_000).toISOString()),
  ]);
  return buildScheduleData({ month, cards: enrichCards(rows, [], now), logs, now, timezone: profile.timezone });
}

export async function getProblemHistoryPage(problemId: string, before?: string) {
  if (!z.string().uuid().safeParse(problemId).success) return { entries: [], nextCursor: null };
  const logs = await readLogsForProblem(problemId, before);
  const entries = logs.slice(0, 20);
  return { entries, nextCursor: logs.length > 20 ? encodeHistoryCursor(entries[entries.length - 1]) : null };
}

export async function getProblemDetail(problemId: string) {
  await connection();
  if (!z.string().uuid().safeParse(problemId).success) return null;
  const profile = await getProfile();
  if (!profile) return null;
  const supabase = await createClient();
  const [problemResult, cardResult, logs] = await Promise.all([
    measure("problem.read", () => supabase.from("problems").select("id,source_id,leetcode_number,slug,title,difficulty,leetcode_url,neetcode_url,problem_topics(position,is_primary,topics(name))").eq("id", problemId).maybeSingle()),
    measure("card.one", () => supabase.from("user_problem_cards").select("due_at,stability,difficulty,elapsed_days,scheduled_days,learning_steps,reps,lapses,state,last_review_at,last_rating,version,first_attempted_at").eq("problem_id", problemId).maybeSingle()),
    getProblemHistoryPage(problemId),
  ]);
  if (problemResult.error || cardResult.error) throw problemResult.error ?? cardResult.error;
  if (!problemResult.data) return null;
  const now = new Date();
  const card = cardResult.data ? (() => {
    const state = toCardState(cardResult.data);
    const latest = logs.entries[0];
    return { ...toProblem(problemResult.data), card: state, retrievability: retrievability(state, now), latest_rating: (latest?.rating as ReviewRating | undefined) ?? (cardResult.data.last_rating as ReviewRating | undefined) ?? null, latest_note: latest?.note ?? null, latest_reviewed_at: latest?.reviewed_at ?? cardResult.data.last_review_at ?? null } satisfies StudyCard;
  })() : null;
  return { profile, problem: toProblem(problemResult.data), card, logs: logs.entries, nextCursor: logs.nextCursor };
}

export async function getProgressData(): Promise<ProgressPayload | null> {
  await connection();
  const now = new Date();
  const profile = await getProfile();
  if (!profile) return null;
  // Use one server-only 365-day event set for Progress. The displayed
  // contribution grid covers 52 Monday–Sunday weeks; the extra local days
  // ensure a UTC offset never drops an edge event before local grouping.
  let activityStart = localDateKey(now, profile.timezone);
  for (let day = 0; day < 365; day += 1) activityStart = previousDateKey(activityStart);
  const analyticsSince = `${previousDateKey(activityStart)}T00:00:00.000Z`;
  const [rows, logs] = await Promise.all([readStudyCards(), readAnalyticsLogs(analyticsSince)]);
  const cards = enrichCards(rows, [], now);
  let ninetyDayStart = localDateKey(now, profile.timezone);
  for (let day = 1; day < 90; day += 1) ninetyDayStart = previousDateKey(ninetyDayStart);
  const activity = activityForWeeks(logs, profile.timezone, now, 52);
  return {
    timezone: profile.timezone,
    todayKey: localDateKey(now, profile.timezone),
    hasCards: cards.length > 0,
    stats: progressSummary(cards, logs, profile.timezone, now, ninetyDayStart),
    attention: attentionProblems(cards, now, profile.timezone).slice(0, 8).map((card) => ({
      id: card.id,
      leetcodeNumber: card.leetcodeNumber,
      title: card.title,
      topics: card.topics,
      primaryTopic: card.primaryTopic,
      reason: attentionReason(card, now, profile.timezone),
      scheduledDays: card.card.scheduled_days,
      dueAt: card.card.due_at,
    })),
    patterns: patternSignals(cards, now, profile.timezone),
    activity,
    activitySummary: activitySummaryForDays(activity),
    recallOutcomes: recallOutcomesForWeeks(logs, profile.timezone, now, 12),
    reviewLoad: reviewLoadForCards(cards, logs, profile.timezone, now),
    scheduler: SCHEDULER_PRESENTATION,
  };
}

export async function getReviewHistory() {
  if (!await getProfile()) return [];
  return readAnalyticsLogs(new Date(Date.now() - 90 * 86_400_000).toISOString());
}

export async function getCatalogSearchIndex(catalogId: CatalogId) {
  const rows = await catalogRows(catalogId);
  const items = new Map<string, { type: "problem" | "pattern"; title: string; subtitle: string; href: string }>();
  for (const row of rows as any[]) {
    const problem = Array.isArray(row.problems) ? row.problems[0] : row.problems;
    if (!problem?.id) continue;
    items.set(`problem:${problem.id}`, { type: "problem", title: `#${problem.leetcode_number ?? leetcodeNumberFromSourceId(problem.source_id)} ${problem.title}`, subtitle: problem.difficulty, href: `/problems/${problem.id}` });
    for (const topic of topicsFrom(problem.problem_topics)) items.set(`pattern:${topic}`, { type: "pattern", title: topic, subtitle: "Filter problem deck", href: `/problems?topic=${encodeURIComponent(topic)}` });
  }
  return [...items.values()];
}

export async function getAdminData() {
  await connection();
  const profile = await getProfile();
  if (!profile || profile.role !== "admin" || !profile.is_active) return { invites: [], snapshots: [] };
  const supabase = createAdminClient();
  const [invites, snapshots] = await Promise.all([
    measure("admin.invites", () => supabase.from("allowed_emails").select("email,invited_at,claimed_at,is_active").order("invited_at", { ascending: false })),
    measure("admin.snapshots", () => supabase.from("catalog_snapshots").select("version,imported_at,problem_count,source_url").order("imported_at", { ascending: false }).limit(6)),
  ]);
  return { invites: invites.data ?? [], snapshots: snapshots.data ?? [] };
}
