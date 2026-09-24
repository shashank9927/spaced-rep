import type { DueProblem, ReviewLoadPayload, ReviewLogSummary, ReviewRating } from "@/lib/types";
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

export function progressSummary(cards: StudyCard[], logs: ReviewLogSummary[], timezone: string, now = new Date()) {
  const weekStart = weekStartKey(now, timezone);
  const currentWeek = activeLogs(logs).filter((log) => localDateKey(new Date(log.reviewed_at), timezone) >= weekStart);
  const attempts = currentWeek.filter((log) => log.event_kind === "first_attempt").length;
  const reviews = currentWeek.filter((log) => log.event_kind !== "first_attempt").length;
  const scheduled = activeLogs(logs).filter((log) => log.event_kind === "scheduled_review");
  const successful = scheduled.filter((log) => log.rating !== "again").length;
  return {
    activeProblemCount: cards.length,
    medianIntervalDays: median(cards.map((card) => card.card.scheduled_days).filter((days) => days > 0)),
    firstAttemptsThisWeek: attempts,
    completedReviewsThisWeek: reviews,
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

function labelForDateKey(dateKey: string, short = false): string {
  return new Intl.DateTimeFormat("en", { weekday: short ? "narrow" : "short", month: short ? undefined : "short", day: short ? undefined : "numeric", timeZone: "UTC" }).format(new Date(`${dateKey}T12:00:00.000Z`));
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
  const peakDay = days.reduce<ReviewLoadPayload["peakDay"]>((peak, day) => day.dueCount && (!peak || day.dueCount > peak.dueCount) ? day : peak, null);
  return { overdueCount, totalDueNext14Days, peakDay, days };
}
