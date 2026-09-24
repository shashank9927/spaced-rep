import type { StudyCard } from "@/lib/analytics";
import type { CatalogProblem, ProblemDifficulty, ProblemSummary, ReviewLogSummary, ScheduleDay, ScheduleItem, StudyPlanPreferences, StudyWeekday } from "@/lib/types";
import { localDateKey } from "@/lib/utils";

const DIFFICULTIES: ProblemDifficulty[] = ["Easy", "Medium", "Hard"];

export interface DailyTarget {
  difficulty: ProblemDifficulty;
  target: number;
  completed: number;
  remaining: number;
  problems: ProblemSummary[];
}

export interface TodayPlan {
  preferences: StudyPlanPreferences;
  dateKey: string;
  targets: DailyTarget[];
}

export interface ScheduleData {
  month: string;
  todayKey: string;
  days: ScheduleDay[];
  selectedCatalog: string;
}

function atNoon(dateKey: string) {
  return new Date(`${dateKey}T12:00:00.000Z`);
}

export function addCalendarDays(dateKey: string, days: number) {
  const date = atNoon(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function weekdayForDate(dateKey: string): StudyWeekday {
  return (["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as StudyWeekday[])[atNoon(dateKey).getUTCDay()];
}

export function monthGrid(month: string): string[] {
  const first = `${month}-01`;
  const mondayOffset = (atNoon(first).getUTCDay() + 6) % 7;
  const start = addCalendarDays(first, -mondayOffset);
  return Array.from({ length: 42 }, (_, index) => addCalendarDays(start, index));
}

function dailyTarget(preferences: StudyPlanPreferences, difficulty: ProblemDifficulty) {
  if (difficulty === "Easy") return preferences.easyPerDay;
  if (difficulty === "Medium") return preferences.mediumPerDay;
  return preferences.hardPerDay;
}

function createDayMap(dateKeys: string[], preferences: StudyPlanPreferences) {
  return new Map(dateKeys.map((dateKey) => [dateKey, {
    dateKey,
    isStudyDay: preferences.studyDays.includes(weekdayForDate(dateKey)),
    items: [] as ScheduleItem[],
  }]));
}

function addItem(days: Map<string, ScheduleDay>, item: ScheduleItem) {
  const day = days.get(item.dateKey);
  if (day) day.items.push(item);
}

function completedToday(cards: StudyCard[], dateKey: string, timezone: string) {
  const counts: Record<ProblemDifficulty, number> = { Easy: 0, Medium: 0, Hard: 0 };
  for (const card of cards) {
    if (localDateKey(new Date(card.card.first_attempted_at), timezone) === dateKey) counts[card.difficulty] += 1;
  }
  return counts;
}

function newProblemCandidates(catalogProblems: CatalogProblem[], cards: StudyCard[]) {
  const activeIds = new Set(cards.map((card) => card.id));
  const result: Record<ProblemDifficulty, ProblemSummary[]> = { Easy: [], Medium: [], Hard: [] };
  for (const problem of [...catalogProblems].sort((a, b) => a.sort_order - b.sort_order)) {
    if (!activeIds.has(problem.id)) result[problem.difficulty].push(problem);
  }
  return result;
}

function addFutureNewProblems({ days, preferences, cards, catalogProblems, todayKey, endKey, timezone }: {
  days: Map<string, ScheduleDay>;
  preferences: StudyPlanPreferences;
  cards: StudyCard[];
  catalogProblems: CatalogProblem[];
  todayKey: string;
  endKey: string;
  timezone: string;
}) {
  if (!preferences.configured) return;
  const candidates = newProblemCandidates(catalogProblems, cards);
  const completed = completedToday(cards, todayKey, timezone);
  let cursor = todayKey;
  while (cursor <= endKey) {
    if (preferences.studyDays.includes(weekdayForDate(cursor))) {
      for (const difficulty of DIFFICULTIES) {
        const count = Math.max(0, dailyTarget(preferences, difficulty) - (cursor === todayKey ? completed[difficulty] : 0));
        for (let index = 0; index < count; index += 1) {
          const problem = candidates[difficulty].shift();
          if (!problem) break;
          addItem(days, {
            dateKey: cursor,
            kind: "new",
            status: cursor === todayKey ? "due" : "upcoming",
            problem,
          });
        }
      }
    }
    cursor = addCalendarDays(cursor, 1);
  }
}

export function getTodayPlan({ preferences, cards, catalogProblems, now, timezone }: {
  preferences: StudyPlanPreferences;
  cards: StudyCard[];
  catalogProblems: CatalogProblem[];
  now: Date;
  timezone: string;
}): TodayPlan {
  const dateKey = localDateKey(now, timezone);
  const days = createDayMap([dateKey], preferences);
  addFutureNewProblems({ days, preferences, cards, catalogProblems, todayKey: dateKey, endKey: dateKey, timezone });
  const completed = completedToday(cards, dateKey, timezone);
  const planned = days.get(dateKey)?.items.filter((item) => item.kind === "new") ?? [];
  return {
    preferences,
    dateKey,
    targets: DIFFICULTIES.map((difficulty) => {
      const target = dailyTarget(preferences, difficulty);
      const problems = planned.filter((item) => item.problem.difficulty === difficulty).map((item) => item.problem);
      return { difficulty, target, completed: completed[difficulty], remaining: problems.length, problems };
    }),
  };
}

export function buildScheduleData({ month, preferences, cards, catalogProblems, logs, now, timezone, selectedCatalog }: {
  month: string;
  preferences: StudyPlanPreferences;
  cards: StudyCard[];
  catalogProblems: CatalogProblem[];
  logs: ReviewLogSummary[];
  now: Date;
  timezone: string;
  selectedCatalog: string;
}): ScheduleData {
  const dateKeys = monthGrid(month);
  const days = createDayMap(dateKeys, preferences);
  const todayKey = localDateKey(now, timezone);
  const [startKey, endKey] = [dateKeys[0], dateKeys.at(-1)!];

  for (const card of cards) {
    const dueKey = localDateKey(new Date(card.card.due_at), timezone);
    const displayKey = dueKey < todayKey ? todayKey : dueKey;
    if (displayKey < startKey || displayKey > endKey) continue;
    const isCurrentlyDue = new Date(card.card.due_at).getTime() <= now.getTime();
    addItem(days, {
      dateKey: displayKey,
      kind: "review",
      status: dueKey < todayKey ? "overdue" : isCurrentlyDue ? "due" : "upcoming",
      dueAt: card.card.due_at,
      problem: card,
    });
  }

  for (const log of logs) {
    const dateKey = localDateKey(new Date(log.reviewed_at), timezone);
    if (dateKey < startKey || dateKey > endKey || !log.problems) continue;
    addItem(days, {
      dateKey,
      kind: log.previous_due_at ? "completed-review" : "completed-new",
      status: "completed",
      dueAt: log.reviewed_at,
      problem: {
        id: log.problem_id,
        source_id: log.problems.source_id ?? "review-log",
        leetcodeNumber: log.problems.source_id ? Number.parseInt(log.problems.source_id, 10) : 0,
        slug: log.problem_id,
        title: log.problems.title,
        difficulty: log.problems.difficulty,
        leetcode_url: null,
        neetcode_url: null,
        topics: [],
      },
    });
  }

  addFutureNewProblems({ days, preferences, cards, catalogProblems, todayKey, endKey, timezone });
  for (const day of days.values()) {
    day.items.sort((a, b) => {
      const statusOrder = { overdue: 0, due: 1, upcoming: 2, completed: 3 };
      return statusOrder[a.status] - statusOrder[b.status] || a.problem.title.localeCompare(b.problem.title);
    });
  }
  return { month, todayKey, days: Array.from(days.values()), selectedCatalog };
}
