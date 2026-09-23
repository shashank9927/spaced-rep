import type { DueProblem, ReviewLogSummary, ReviewRating } from "@/lib/types";
import { localDateKey } from "@/lib/utils";

export type StudyCard = DueProblem & {
  retrievability: number;
  latest_rating: ReviewRating | null;
  latest_note: string | null;
  latest_reviewed_at: string | null;
};

export function percentage(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(value)) return null;
  return Math.round(Math.min(1, Math.max(0, value)) * 100);
}

export function isStrong(card: StudyCard): boolean {
  return card.card.stability >= 30 && card.retrievability >= 0.9;
}

export function isWeak(card: StudyCard): boolean {
  return card.retrievability < 0.75 || card.latest_rating === "again" || card.latest_rating === "hard";
}

export function previousDateKey(key: string): string {
  const date = new Date(`${key}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function nextDateKey(key: string): string {
  const date = new Date(`${key}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function currentStreak(logs: Pick<ReviewLogSummary, "reviewed_at">[], timezone: string, now = new Date()): number {
  const reviewedDays = new Set(logs.map((log) => localDateKey(new Date(log.reviewed_at), timezone)));
  let cursor = localDateKey(now, timezone);
  if (!reviewedDays.has(cursor)) cursor = previousDateKey(cursor);
  let streak = 0;
  while (reviewedDays.has(cursor)) {
    streak += 1;
    cursor = previousDateKey(cursor);
  }
  return streak;
}

export function longestStreak(logs: Pick<ReviewLogSummary, "reviewed_at">[], timezone: string): number {
  const days = Array.from(new Set(logs.map((log) => localDateKey(new Date(log.reviewed_at), timezone)))).sort();
  let best = 0;
  let running = 0;
  let previous: string | null = null;
  for (const day of days) {
    running = previous && day === nextDateKey(previous) ? running + 1 : 1;
    best = Math.max(best, running);
    previous = day;
  }
  return best;
}

export function weekStartKey(now: Date, timezone: string): string {
  const today = localDateKey(now, timezone);
  const date = new Date(`${today}T12:00:00.000Z`);
  const offset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
}

export function reviewStats(cards: StudyCard[], logs: ReviewLogSummary[], timezone: string, now = new Date()) {
  const currentWeek = weekStartKey(now, timezone);
  const weekLogs = logs.filter((log) => localDateKey(new Date(log.reviewed_at), timezone) >= currentWeek);
  const successful = logs.filter((log) => log.rating === "good" || log.rating === "easy");
  const timed = logs.filter((log) => log.duration_minutes != null);
  const averageRetrievability = cards.length ? cards.reduce((sum, card) => sum + card.retrievability, 0) / cards.length : null;
  const strong = cards.filter(isStrong);
  const weak = cards.filter(isWeak);
  return {
    activeCount: cards.length,
    strongCount: strong.length,
    weakCount: weak.length,
    learningCount: cards.length - strong.length,
    averageRetrievability,
    recallSuccessRate: logs.length ? successful.length / logs.length : null,
    reviewsThisWeek: weekLogs.length,
    averageDuration: timed.length ? Math.round(timed.reduce((sum, log) => sum + (log.duration_minutes ?? 0), 0) / timed.length) : null,
    currentStreak: currentStreak(logs, timezone, now),
    longestStreak: longestStreak(logs, timezone),
    strong,
    weak,
  };
}

export function queueOrder(a: StudyCard, b: StudyCard): number {
  return a.retrievability - b.retrievability
    || b.card.lapses - a.card.lapses
    || new Date(a.card.due_at).getTime() - new Date(b.card.due_at).getTime();
}

export function patternStats(cards: StudyCard[]) {
  const grouped = new Map<string, StudyCard[]>();
  for (const card of cards) {
    for (const topic of card.topics) grouped.set(topic, [...(grouped.get(topic) ?? []), card]);
  }
  return Array.from(grouped, ([name, values]) => ({
    name,
    activeCount: values.length,
    retrievability: values.reduce((sum, value) => sum + value.retrievability, 0) / values.length,
    problems: values.sort(queueOrder),
  })).sort((a, b) => a.retrievability - b.retrievability || a.name.localeCompare(b.name));
}

export function activityForDays(logs: ReviewLogSummary[], timezone: string, now = new Date(), count = 84) {
  const byDay = new Map<string, number>();
  for (const log of logs) {
    const key = localDateKey(new Date(log.reviewed_at), timezone);
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }
  const current = localDateKey(now, timezone);
  const keys: string[] = [];
  let cursor = current;
  for (let index = 0; index < count; index += 1) {
    keys.unshift(cursor);
    cursor = previousDateKey(cursor);
  }
  return keys.map((key) => ({ key, count: byDay.get(key) ?? 0 }));
}
