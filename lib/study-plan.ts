import type { StudyCard } from "@/lib/analytics";
import type { ReviewLogSummary, ScheduleDay, ScheduleItem } from "@/lib/types";
import { localDateKey } from "@/lib/utils";

export interface ScheduleData {
  month: string;
  todayKey: string;
  days: ScheduleDay[];
}

function atNoon(dateKey: string) {
  return new Date(`${dateKey}T12:00:00.000Z`);
}

export function addCalendarDays(dateKey: string, days: number) {
  const date = atNoon(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function monthGrid(month: string): string[] {
  const first = `${month}-01`;
  const mondayOffset = (atNoon(first).getUTCDay() + 6) % 7;
  const start = addCalendarDays(first, -mondayOffset);
  return Array.from({ length: 42 }, (_, index) => addCalendarDays(start, index));
}

/** A review belongs to its local calendar day, even before its original clock time. */
export function isDueOnOrBeforeLocalDay(dueAt: string, now: Date, timezone: string) {
  return localDateKey(new Date(dueAt), timezone) <= localDateKey(now, timezone);
}

function addItem(days: Map<string, ScheduleDay>, item: ScheduleItem) {
  const day = days.get(item.dateKey);
  if (day) day.items.push(item);
}

/**
 * Builds a calendar from recorded attempts and FSRS cards only. It deliberately
 * does not infer, assign, or forecast new problems.
 */
export function buildScheduleData({ month, cards, logs, now, timezone }: {
  month: string;
  cards: StudyCard[];
  logs: ReviewLogSummary[];
  now: Date;
  timezone: string;
}): ScheduleData {
  const dateKeys = monthGrid(month);
  const days = new Map(dateKeys.map((dateKey) => [dateKey, { dateKey, items: [] as ScheduleItem[] }]));
  const todayKey = localDateKey(now, timezone);
  const [startKey, endKey] = [dateKeys[0], dateKeys.at(-1)!];

  for (const card of cards) {
    const dueKey = localDateKey(new Date(card.card.due_at), timezone);
    const displayKey = dueKey < todayKey ? todayKey : dueKey;
    if (displayKey < startKey || displayKey > endKey) continue;
    addItem(days, {
      dateKey: displayKey,
      kind: "review",
      status: dueKey < todayKey ? "overdue" : dueKey === todayKey ? "due" : "upcoming",
      dueAt: card.card.due_at,
      problem: card,
    });
  }

  for (const log of logs) {
    if (log.reversed_at) continue;
    const dateKey = localDateKey(new Date(log.reviewed_at), timezone);
    if (dateKey < startKey || dateKey > endKey || !log.problems) continue;
    const eventKind = log.event_kind ?? (log.previous_due_at ? "scheduled_review" : "first_attempt");
    addItem(days, {
      dateKey,
      kind: eventKind === "first_attempt" ? "completed-attempt" : eventKind === "early_review" ? "completed-early-review" : "completed-review",
      status: "completed",
      dueAt: log.reviewed_at,
      problem: {
        id: log.problem_id,
        source_id: log.problems.source_id ?? "review-log",
        leetcodeNumber: log.problems.leetcode_number ?? (log.problems.source_id ? Number.parseInt(log.problems.source_id, 10) : 0),
        slug: log.problem_id,
        title: log.problems.title,
        difficulty: log.problems.difficulty,
        leetcode_url: null,
        neetcode_url: null,
        topics: [],
      },
    });
  }

  for (const day of days.values()) {
    const statusOrder = { overdue: 0, due: 1, upcoming: 2, completed: 3 };
    day.items.sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || a.problem.title.localeCompare(b.problem.title));
  }
  return { month, todayKey, days: Array.from(days.values()) };
}
