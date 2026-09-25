import type { ActivityDay, ActivitySummary, DueProblem, RecallOutcomeWeek, ReviewLoadPayload, ReviewLogSummary, ReviewRating } from "@/lib/types";
import { localDateKey } from "@/lib/utils";

export type StudyCard = DueProblem & {
  retrievability: number;
  latest_rating: ReviewRating | null;
  latest_note: string | null;
  latest_reviewed_at: string | null;
};

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
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

export function queueOrder(a: StudyCard, b: StudyCard): number {
  return a.retrievability - b.retrievability
    || b.card.lapses - a.card.lapses
    || new Date(a.card.due_at).getTime() - new Date(b.card.due_at).getTime();
}

// Kept as compatibility helpers for existing unit tests and older consumers.
// Product V2 does not surface these as “mastery” metrics.
export function isStrong(card: StudyCard): boolean { return card.card.stability >= 30 && card.retrievability >= .9; }
export function isWeak(card: StudyCard): boolean { return card.retrievability < .75 || card.latest_rating === "again" || card.latest_rating === "hard"; }

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function activeLogs(logs: ReviewLogSummary[]) { return logs.filter((log) => !log.reversed_at); }

export function progressSummary(cards: StudyCard[], logs: ReviewLogSummary[], timezone: string, now = new Date(), scheduledSinceKey?: string) {
  const weekStart = weekStartKey(now, timezone);
  const today = localDateKey(now, timezone);
  const active = activeLogs(logs).filter((log) => {
    const key = localDateKey(new Date(log.reviewed_at), timezone);
    return key <= today;
  });
  const currentWeek = active.filter((log) => {
    const key = localDateKey(new Date(log.reviewed_at), timezone);
    return key >= weekStart && key <= today;
  });
  const attempts = currentWeek.filter((log) => log.event_kind === "first_attempt").length;
  const reviews = currentWeek.filter((log) => log.event_kind === "scheduled_review").length;
  const earlyReviews = currentWeek.filter((log) => log.event_kind === "early_review").length;
  const activeStudyDaysThisWeek = new Set(currentWeek.map((log) => localDateKey(new Date(log.reviewed_at), timezone))).size;
  const scheduled = active.filter((log) => log.event_kind === "scheduled_review" && (!scheduledSinceKey || localDateKey(new Date(log.reviewed_at), timezone) >= scheduledSinceKey));
  const successful = scheduled.filter((log) => log.rating !== "again").length;
  return {
    activeProblemCount: cards.length,
    medianIntervalDays: median(cards.map((card) => card.card.scheduled_days).filter((days) => days > 0)),
    firstAttemptsThisWeek: attempts,
    completedReviewsThisWeek: reviews,
    earlyReviewsThisWeek: earlyReviews,
    activeStudyDaysThisWeek,
    scheduledRecallRate: scheduled.length >= 20 ? successful / scheduled.length : null,
    scheduledRecallSampleSize: scheduled.length,
  };
}

export function attentionProblems(cards: StudyCard[], now = new Date(), timezone = "UTC") {
  const today = localDateKey(now, timezone);
  return cards.filter((card) => localDateKey(new Date(card.card.due_at), timezone) <= today || card.latest_rating === "again" || card.latest_rating === "hard" || card.card.lapses >= 2).sort((a, b) => {
    const rank = (card: StudyCard) => localDateKey(new Date(card.card.due_at), timezone) <= today ? 0 : card.latest_rating === "again" ? 1 : card.latest_rating === "hard" ? 2 : 3;
    return rank(a) - rank(b) || b.card.lapses - a.card.lapses || a.card.scheduled_days - b.card.scheduled_days || new Date(a.card.due_at).getTime() - new Date(b.card.due_at).getTime();
  });
}

export function attentionReason(card: StudyCard, now = new Date(), timezone = "UTC") {
  if (localDateKey(new Date(card.card.due_at), timezone) <= localDateKey(now, timezone)) return "due" as const;
  if (card.latest_rating === "again") return "forgot" as const;
  if (card.latest_rating === "hard") return "hard" as const;
  return "repeated-lapses" as const;
}

export function patternSignals(cards: StudyCard[], now = new Date(), timezone = "UTC") {
  const grouped = new Map<string, StudyCard[]>();
  for (const card of cards) {
    const topic = card.primaryTopic ?? card.topics[0];
    if (topic) grouped.set(topic, [...(grouped.get(topic) ?? []), card]);
  }
  const today = localDateKey(now, timezone);
  return Array.from(grouped, ([name, values]) => {
    const reinforcementCount = values.filter((card) => card.latest_rating === "again" || card.latest_rating === "hard" || card.card.lapses >= 2).length;
    return { name, activeCount: values.length, dueCount: values.filter((card) => localDateKey(new Date(card.card.due_at), timezone) <= today).length, reinforcementCount, medianIntervalDays: median(values.map((card) => card.card.scheduled_days).filter((days) => days > 0)) };
  }).filter((signal) => signal.activeCount >= 2).sort((a, b) => b.dueCount - a.dueCount || (b.reinforcementCount / b.activeCount) - (a.reinforcementCount / a.activeCount) || (a.medianIntervalDays ?? Infinity) - (b.medianIntervalDays ?? Infinity) || a.name.localeCompare(b.name));
}

export function activityForDays(logs: ReviewLogSummary[], timezone: string, now = new Date(), count = 28) {
  const byDay = new Map<string, { attempts: number; scheduled: number; early: number }>();
  for (const log of activeLogs(logs)) {
    const key = localDateKey(new Date(log.reviewed_at), timezone);
    const item = byDay.get(key) ?? { attempts: 0, scheduled: 0, early: 0 };
    if (log.event_kind === "first_attempt") item.attempts += 1;
    else if (log.event_kind === "early_review") item.early += 1;
    else item.scheduled += 1;
    byDay.set(key, item);
  }
  const keys: string[] = []; let cursor = localDateKey(now, timezone);
  for (let index = 0; index < count; index += 1) { keys.unshift(cursor); cursor = previousDateKey(cursor); }
  return keys.map((key) => ({ key, ...byDay.get(key) ?? { attempts: 0, scheduled: 0, early: 0 } }));
}

/** Returns twelve Monday–Sunday calendar weeks, with future days marked rather than counted as inactivity. */
export function activityForWeeks(logs: ReviewLogSummary[], timezone: string, now = new Date(), weekCount = 12): ActivityDay[] {
  const today = localDateKey(now, timezone);
  let cursor = weekStartKey(now, timezone);
  const daysToSubtract = (weekCount - 1) * 7;
  for (let index = 0; index < daysToSubtract; index += 1) cursor = previousDateKey(cursor);
  const byDay = new Map<string, { attempts: number; scheduled: number; early: number }>();
  for (const log of activeLogs(logs)) {
    const key = localDateKey(new Date(log.reviewed_at), timezone);
    const value = byDay.get(key) ?? { attempts: 0, scheduled: 0, early: 0 };
    if (log.event_kind === "first_attempt") value.attempts += 1;
    else if (log.event_kind === "early_review") value.early += 1;
    else value.scheduled += 1;
    byDay.set(key, value);
  }
  return Array.from({ length: weekCount * 7 }, (_, index) => {
    const key = nextDateKeyBy(cursor, index);
    return { key, ...byDay.get(key) ?? { attempts: 0, scheduled: 0, early: 0 }, isFuture: key > today };
  });
}

function nextDateKeyBy(key: string, amount: number) {
  const date = new Date(`${key}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function dateLabel(dateKey: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${dateKey}T12:00:00.000Z`));
}

export function activitySummaryForDays(days: ActivityDay[]): ActivitySummary {
  const elapsed = days.filter((day) => !day.isFuture);
  const totals = elapsed.reduce((sum, day) => ({
    firstAttempts: sum.firstAttempts + day.attempts,
    scheduledReviews: sum.scheduledReviews + day.scheduled,
    earlyReviews: sum.earlyReviews + day.early,
    activeDays: sum.activeDays + (day.attempts + day.scheduled + day.early > 0 ? 1 : 0),
  }), { firstAttempts: 0, scheduledReviews: 0, earlyReviews: 0, activeDays: 0 });
  return { ...totals, totalEvents: totals.firstAttempts + totals.scheduledReviews + totals.earlyReviews };
}

export function recallOutcomesForWeeks(logs: ReviewLogSummary[], timezone: string, now = new Date(), weekCount = 12): RecallOutcomeWeek[] {
  const currentWeekKey = weekStartKey(now, timezone);
  let firstWeekKey = currentWeekKey;
  for (let index = 1; index < weekCount; index += 1) firstWeekKey = nextDateKeyBy(firstWeekKey, -7);
  const keys = Array.from({ length: weekCount }, (_, index) => nextDateKeyBy(firstWeekKey, index * 7));
  const buckets = new Map(keys.map((key) => [key, { recalledCount: 0, forgotCount: 0 }]));
  const today = localDateKey(now, timezone);
  for (const log of activeLogs(logs)) {
    if (log.event_kind !== "scheduled_review") continue;
    const reviewedKey = localDateKey(new Date(log.reviewed_at), timezone);
    if (reviewedKey > today) continue;
    const date = new Date(`${reviewedKey}T12:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    const weekKey = date.toISOString().slice(0, 10);
    const bucket = buckets.get(weekKey);
    if (!bucket) continue;
    if (log.rating === "again") bucket.forgotCount += 1;
    else bucket.recalledCount += 1;
  }
  return keys.map((weekKey) => {
    const bucket = buckets.get(weekKey)!;
    const sampleSize = bucket.recalledCount + bucket.forgotCount;
    return {
      weekKey,
      label: dateLabel(weekKey),
      recalledCount: bucket.recalledCount,
      forgotCount: bucket.forgotCount,
      sampleSize,
      recallRate: sampleSize ? bucket.recalledCount / sampleSize : null,
      isCurrentWeek: weekKey === currentWeekKey,
    };
  });
}

function labelForDateKey(dateKey: string, short = false): string {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  const weekday = new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" }).format(date);
  const day = new Intl.DateTimeFormat("en", { day: "numeric", timeZone: "UTC" }).format(date);
  if (short) return `${weekday} ${day}`;
  const month = new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(date);
  return `${weekday}, ${month} ${day}`;
}

export function reviewLoadForCards(cards: StudyCard[], logs: ReviewLogSummary[], timezone: string, now = new Date(), count = 14): ReviewLoadPayload {
  const today = localDateKey(now, timezone); const dueByDay = new Map<string, number>(); let overdueCount = 0;
  for (const card of cards) { const day = localDateKey(new Date(card.card.due_at), timezone); if (day < today) overdueCount += 1; else dueByDay.set(day, (dueByDay.get(day) ?? 0) + 1); }
  const completedByDay = new Map<string, number>();
  for (const log of activeLogs(logs).filter((item) => (item.event_kind ?? "scheduled_review") === "scheduled_review")) { const key = localDateKey(new Date(log.reviewed_at), timezone); completedByDay.set(key, (completedByDay.get(key) ?? 0) + 1); }
  const days: ReviewLoadPayload["days"] = []; let cursor = today;
  for (let index = 0; index < count; index += 1) {
    const dueCount = dueByDay.get(cursor) ?? 0; const completedCount = completedByDay.get(cursor) ?? 0;
    days.push({ dateKey: cursor, label: labelForDateKey(cursor), shortLabel: labelForDateKey(cursor, true), fullLabel: labelForDateKey(cursor), dueCount, completedCount, completedReviewCount: completedCount, remainingTodayCount: cursor === today ? dueCount : 0, futureDueCount: cursor === today ? 0 : dueCount, isToday: cursor === today }); cursor = nextDateKey(cursor);
  }
  const totalDueNext14Days = days.reduce((total, day) => total + day.dueCount, 0);
  const peakDay = days.filter((day) => !day.isToday).reduce<ReviewLoadPayload["peakDay"]>((peak, day) => day.dueCount && (!peak || day.dueCount > peak.dueCount) ? day : peak, null);
  const windowEnd = days.at(-1)?.dateKey ?? today;
  const nextCard = cards
    .map((card) => ({ card, dateKey: localDateKey(new Date(card.card.due_at), timezone) }))
    .filter(({ dateKey }) => dateKey > windowEnd)
    .sort((a, b) => new Date(a.card.card.due_at).getTime() - new Date(b.card.card.due_at).getTime())[0];
  return { overdueCount, totalDueNext14Days, peakDay, nextReviewAfterWindow: nextCard ? { dateKey: nextCard.dateKey, label: labelForDateKey(nextCard.dateKey) } : null, days };
}
