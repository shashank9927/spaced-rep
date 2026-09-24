import type { DueProblem, ReviewLoadPayload, ReviewLogSummary, ReviewRating } from "@/lib/types";
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

function labelForDateKey(dateKey: string): string {
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    // A dateKey already represents a calendar date in the user's timezone.
    // Format it in UTC so extreme positive/negative offsets cannot roll the
    // label onto an adjacent day.
    timeZone: "UTC",
  }).format(new Date(`${dateKey}T12:00:00.000Z`));
}

/**
 * Builds the real upcoming FSRS workload in the user's local calendar. New
 * problems are intentionally not included: only activated cards can create a
 * future review date.
 */
export function reviewLoadForCards(
  cards: StudyCard[],
  logs: ReviewLogSummary[],
  timezone: string,
  now = new Date(),
  count = 14,
): ReviewLoadPayload {
  const today = localDateKey(now, timezone);
  const byDate = new Map<string, number>();
  let overdueCount = 0;

  for (const card of cards) {
    const dueDate = localDateKey(new Date(card.card.due_at), timezone);
    if (dueDate < today) overdueCount += 1;
    else byDate.set(dueDate, (byDate.get(dueDate) ?? 0) + 1);
  }

  const completedByDate = new Map<string, number>();
  for (const log of logs) {
    const dateKey = localDateKey(new Date(log.reviewed_at), timezone);
    completedByDate.set(dateKey, (completedByDate.get(dateKey) ?? 0) + 1);
  }

  const days: ReviewLoadPayload["days"] = [];
  let cursor = today;
  for (let index = 0; index < count; index += 1) {
    days.push({
      dateKey: cursor,
      label: labelForDateKey(cursor),
      dueCount: byDate.get(cursor) ?? 0,
      completedCount: completedByDate.get(cursor) ?? 0,
      isToday: cursor === today,
    });
    cursor = nextDateKey(cursor);
  }

  const totalDueNext14Days = days.reduce((total, day) => total + day.dueCount, 0);
  const peakDay = days.reduce<ReviewLoadPayload["peakDay"]>((peak, day) => {
    if (day.dueCount === 0) return peak;
    return !peak || day.dueCount > peak.dueCount ? day : peak;
  }, null);

  return { overdueCount, totalDueNext14Days, peakDay, days };
}
