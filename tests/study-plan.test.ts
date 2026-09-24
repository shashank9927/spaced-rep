import { describe, expect, it } from "vitest";
import { buildScheduleData, getTodayPlan } from "@/lib/study-plan";
import type { StudyCard } from "@/lib/analytics";
import type { CatalogProblem, StudyPlanPreferences } from "@/lib/types";

const preferences: StudyPlanPreferences = { easyPerDay: 2, mediumPerDay: 1, hardPerDay: 0, studyDays: ["mon", "wed", "fri"], configured: true };

function catalog(id: string, difficulty: CatalogProblem["difficulty"], sort_order: number): CatalogProblem {
  return { id, source_id: id, slug: id, title: id, difficulty, leetcode_url: null, neetcode_url: null, topics: [], sort_order, card: null };
}

function active(id: string, difficulty: StudyCard["difficulty"], firstSolvedAt = "2026-09-21T08:00:00.000Z"): StudyCard {
  return {
    id, source_id: id, slug: id, title: id, difficulty, leetcode_url: null, neetcode_url: null, topics: [], retrievability: .8, latest_rating: "good", latest_note: null, latest_reviewed_at: firstSolvedAt,
    card: { due: "2026-09-22T08:00:00.000Z", due_at: "2026-09-22T08:00:00.000Z", stability: 3, difficulty: 5, elapsed_days: 0, scheduled_days: 1, learning_steps: 0, reps: 1, lapses: 0, state: 1, last_review: firstSolvedAt, version: 1, first_solved_at: firstSolvedAt },
  };
}

describe("study plan forecasting", () => {
  it("allocates new problems by difficulty and catalog order", () => {
    const plan = getTodayPlan({ preferences, cards: [], catalogProblems: [catalog("easy-second", "Easy", 3), catalog("medium-first", "Medium", 2), catalog("easy-first", "Easy", 1)], now: new Date("2026-09-21T10:00:00.000Z"), timezone: "UTC" });
    expect(plan.targets.find((target) => target.difficulty === "Easy")?.problems.map((problem) => problem.id)).toEqual(["easy-first", "easy-second"]);
    expect(plan.targets.find((target) => target.difficulty === "Medium")?.problems.map((problem) => problem.id)).toEqual(["medium-first"]);
  });

  it("counts an extra first solve against today without reducing tomorrow's target", () => {
    const cards = [active("solved-early", "Easy")];
    const today = getTodayPlan({ preferences, cards, catalogProblems: [catalog("easy-a", "Easy", 1), catalog("easy-b", "Easy", 2), catalog("easy-c", "Easy", 3), catalog("medium", "Medium", 4)], now: new Date("2026-09-21T10:00:00.000Z"), timezone: "UTC" });
    expect(today.targets.find((target) => target.difficulty === "Easy")?.remaining).toBe(1);
    const schedule = buildScheduleData({ month: "2026-09", preferences, cards, catalogProblems: [catalog("easy-a", "Easy", 1), catalog("easy-b", "Easy", 2), catalog("easy-c", "Easy", 3), catalog("easy-d", "Easy", 4), catalog("medium", "Medium", 5)], logs: [], now: new Date("2026-09-21T10:00:00.000Z"), timezone: "UTC", selectedCatalog: "neetcode150" });
    expect(schedule.days.find((day) => day.dateKey === "2026-09-23")?.items.filter((item) => item.kind === "new" && item.problem.difficulty === "Easy")).toHaveLength(2);
  });

  it("does not assign new problems on rest days but still shows reviews", () => {
    const cards = [active("review", "Easy", "2026-09-01T08:00:00.000Z")];
    const schedule = buildScheduleData({ month: "2026-09", preferences, cards, catalogProblems: [catalog("easy", "Easy", 1)], logs: [], now: new Date("2026-09-22T10:00:00.000Z"), timezone: "UTC", selectedCatalog: "neetcode150" });
    const restDay = schedule.days.find((day) => day.dateKey === "2026-09-22")!;
    expect(restDay.isStudyDay).toBe(false);
    expect(restDay.items.some((item) => item.kind === "new")).toBe(false);
    expect(restDay.items.some((item) => item.kind === "review")).toBe(true);
  });
});
