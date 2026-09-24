import { describe, expect, it } from "vitest";
import { buildScheduleData, isDueOnOrBeforeLocalDay } from "@/lib/study-plan";
import type { StudyCard } from "@/lib/analytics";
import type { ReviewLogSummary } from "@/lib/types";

function active(id: string, dueAt = "2026-09-23T20:00:00.000Z"): StudyCard {
  return {
    id, source_id: "0001-two-sum", leetcodeNumber: 1, slug: id, title: id, difficulty: "Easy", leetcode_url: null, neetcode_url: null, topics: [], retrievability: .8, latest_rating: "good", latest_note: null, latest_reviewed_at: "2026-09-20T08:00:00.000Z",
    card: { due: dueAt, due_at: dueAt, stability: 3, difficulty: 5, elapsed_days: 0, scheduled_days: 3, learning_steps: 0, reps: 1, lapses: 0, state: 2, last_review: "2026-09-20T08:00:00.000Z", version: 1, first_attempted_at: "2026-09-20T08:00:00.000Z" },
  };
}

describe("manual queue schedule", () => {
  it("shows a review due later today from the start of the user local day", () => {
    const now = new Date("2026-09-23T07:00:00.000Z");
    expect(isDueOnOrBeforeLocalDay("2026-09-23T20:00:00.000Z", now, "UTC")).toBe(true);
    expect(isDueOnOrBeforeLocalDay("2026-09-24T00:01:00.000Z", now, "UTC")).toBe(false);
  });

  it("contains only real card dates and recorded events, never forecasts", () => {
    const logs: ReviewLogSummary[] = [{ id: "log", problem_id: "attempt", rating: "again", reviewed_at: "2026-09-22T11:00:00.000Z", note: null, previous_due_at: null, next_due_at: "2026-09-23T11:00:00.000Z", scheduled_days: 1, problems: { title: "Attempt", difficulty: "Easy", source_id: "0002-attempt", leetcode_number: 2 } }];
    const schedule = buildScheduleData({ month: "2026-09", cards: [active("review")], logs, now: new Date("2026-09-23T07:00:00.000Z"), timezone: "UTC" });
    expect(schedule.days.find((day) => day.dateKey === "2026-09-23")?.items.some((item) => item.kind === "review" && item.status === "due")).toBe(true);
    expect(schedule.days.find((day) => day.dateKey === "2026-09-22")?.items.some((item) => item.kind === "completed-attempt")).toBe(true);
    expect(schedule.days.flatMap((day) => day.items).every((item) => item.kind !== ("new" as never))).toBe(true);
  });
});
