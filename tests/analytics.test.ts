import { describe, expect, it } from "vitest";
import { activityForWeeks, activitySummaryForDays, attentionProblems, isStrong, isWeak, progressSummary, queueOrder, recallOutcomesForWeeks, reviewLoadForCards } from "@/lib/analytics";
import type { StudyCard } from "@/lib/analytics";
import type { ReviewLogSummary } from "@/lib/types";

function card(overrides: Partial<StudyCard> = {}): StudyCard {
  return {
    id: "00000000-0000-4000-8000-000000000001", source_id: "0001-one", slug: "one", title: "One", difficulty: "Easy", leetcode_url: null, neetcode_url: null, topics: ["Arrays"],
    retrievability: .8, latest_rating: "good", latest_note: null, latest_reviewed_at: null,
    card: { due: "2026-09-23T10:00:00.000Z", due_at: "2026-09-23T10:00:00.000Z", stability: 10, difficulty: 5, elapsed_days: 2, scheduled_days: 3, learning_steps: 0, reps: 2, lapses: 0, state: 2, last_review: "2026-09-21T10:00:00.000Z", version: 1, first_attempted_at: "2026-09-01T10:00:00.000Z" },
    ...overrides,
    leetcodeNumber: overrides.leetcodeNumber ?? 1,
  };
}

describe("study analytics", () => {
  it("classifies strong and weak cards from FSRS data and latest rating", () => {
    expect(isStrong(card({ retrievability: .92, card: { ...card().card, stability: 31 } }))).toBe(true);
    expect(isWeak(card({ retrievability: .96, latest_rating: "hard" }))).toBe(true);
  });

  it("orders the due queue by retrievability before other tiebreakers", () => {
    const weakest = card({ retrievability: .48 });
    const stronger = card({ retrievability: .72, card: { ...card().card, lapses: 9 } });
    expect([stronger, weakest].sort(queueOrder)[0].retrievability).toBe(.48);
  });

  it("keeps overdue cards separate and finds the busiest upcoming day", () => {
    const now = new Date("2026-09-24T10:00:00.000Z");
    const overdue = card({ id: "00000000-0000-4000-8000-000000000001", card: { ...card().card, due_at: "2026-09-23T10:00:00.000Z" } });
    const dueToday = card({ id: "00000000-0000-4000-8000-000000000002", card: { ...card().card, due_at: "2026-09-24T10:00:00.000Z" } });
    const dueTomorrow = card({ id: "00000000-0000-4000-8000-000000000003", card: { ...card().card, due_at: "2026-09-25T10:00:00.000Z" } });
    const load = reviewLoadForCards([overdue, dueToday, dueTomorrow], [], "Europe/Berlin", now);

    expect(load.overdueCount).toBe(1);
    expect(load.totalDueNext14Days).toBe(2);
    expect(load.days[0]).toMatchObject({ dateKey: "2026-09-24", dueCount: 1, isToday: true });
    expect(load.days[1]).toMatchObject({ dateKey: "2026-09-25", dueCount: 1 });
    expect(load.peakDay?.dateKey).toBe("2026-09-25");
  });

  it("groups completed activity and due dates by the user's timezone", () => {
    const dueNextLocalDay = card({ card: { ...card().card, due_at: "2026-09-25T07:30:00.000Z" } });
    const log = { id: "log-1", problem_id: dueNextLocalDay.id, rating: "good" as const, reviewed_at: "2026-09-24T23:30:00.000Z", note: null, previous_due_at: null, next_due_at: "2026-09-28T12:00:00.000Z", scheduled_days: 4 };
    const load = reviewLoadForCards([dueNextLocalDay], [log], "America/Los_Angeles", new Date("2026-09-24T23:00:00.000Z"));

    expect(load.days[0]).toMatchObject({ dateKey: "2026-09-24", dueCount: 0, completedCount: 1 });
    expect(load.days[1]).toMatchObject({ dateKey: "2026-09-25", dueCount: 1 });
  });

  it("returns an empty fourteen-day window without inventing workload", () => {
    const load = reviewLoadForCards([], [], "UTC", new Date("2026-09-24T10:00:00.000Z"));
    expect(load.days).toHaveLength(14);
    expect(load.overdueCount).toBe(0);
    expect(load.totalDueNext14Days).toBe(0);
    expect(load.peakDay).toBeNull();
  });

  it("reports the next real review beyond an otherwise empty window with unambiguous labels", () => {
    const later = card({ card: { ...card().card, due_at: "2026-10-12T10:00:00.000Z" } });
    const load = reviewLoadForCards([later], [], "UTC", new Date("2026-09-24T10:00:00.000Z"));
    expect(load.totalDueNext14Days).toBe(0);
    expect(load.nextReviewAfterWindow).toMatchObject({ dateKey: "2026-10-12" });
    expect(load.days[0]?.shortLabel).toMatch(/^Thu 24$/);
  });

  it("counts only scheduled, non-undone reviews for the recall sample", () => {
    const logs: ReviewLogSummary[] = Array.from({ length: 20 }, (_, index) => ({
      id: "scheduled-" + index, problem_id: card().id, rating: index === 0 ? "again" as const : "good" as const,
      reviewed_at: "2026-09-24T10:00:00.000Z", note: null, previous_due_at: "2026-09-23T10:00:00.000Z",
      next_due_at: "2026-09-27T10:00:00.000Z", scheduled_days: 3, event_kind: "scheduled_review" as const,
    }));
    logs.push({ id: "undone", problem_id: card().id, rating: "again", reviewed_at: "2026-09-24T10:00:00.000Z", note: null, previous_due_at: null, next_due_at: "2026-09-25T10:00:00.000Z", scheduled_days: 1, event_kind: "scheduled_review", reversed_at: "2026-09-24T10:01:00.000Z" });
    const summary = progressSummary([card()], logs, "UTC", new Date("2026-09-24T12:00:00.000Z"));
    expect(summary.scheduledRecallSampleSize).toBe(20);
    expect(summary.scheduledRecallRate).toBeCloseTo(.95);
  });

  it("uses the exact local-date recall window instead of a rolling timestamp approximation", () => {
    const logs: ReviewLogSummary[] = [
      { id: "inside", problem_id: card().id, rating: "good", reviewed_at: "2026-06-27T00:01:00.000Z", note: null, previous_due_at: "2026-06-26T10:00:00.000Z", next_due_at: "2026-06-30T10:00:00.000Z", scheduled_days: 3, event_kind: "scheduled_review" },
      { id: "outside", problem_id: card().id, rating: "again", reviewed_at: "2026-06-26T23:59:00.000Z", note: null, previous_due_at: "2026-06-25T10:00:00.000Z", next_due_at: "2026-06-27T10:00:00.000Z", scheduled_days: 1, event_kind: "scheduled_review" },
    ];
    const summary = progressSummary([card()], logs, "UTC", new Date("2026-09-24T12:00:00.000Z"), "2026-06-27");
    expect(summary.scheduledRecallSampleSize).toBe(1);
  });

  it("counts scheduled recalls separately from early reviews and counts active local study days", () => {
    const logs: ReviewLogSummary[] = [
      { id: "attempt", problem_id: card().id, rating: "good", reviewed_at: "2026-09-21T08:00:00.000Z", note: null, previous_due_at: null, next_due_at: "2026-09-22T08:00:00.000Z", scheduled_days: 1, event_kind: "first_attempt" },
      { id: "scheduled", problem_id: card().id, rating: "hard", reviewed_at: "2026-09-23T08:00:00.000Z", note: null, previous_due_at: "2026-09-22T08:00:00.000Z", next_due_at: "2026-09-25T08:00:00.000Z", scheduled_days: 2, event_kind: "scheduled_review" },
      { id: "early", problem_id: card().id, rating: "again", reviewed_at: "2026-09-24T08:00:00.000Z", note: null, previous_due_at: "2026-09-25T08:00:00.000Z", next_due_at: "2026-09-25T08:00:00.000Z", scheduled_days: 1, event_kind: "early_review" },
    ];
    const summary = progressSummary([card()], logs, "Europe/Berlin", new Date("2026-09-24T12:00:00.000Z"));
    expect(summary).toMatchObject({ firstAttemptsThisWeek: 1, completedReviewsThisWeek: 1, earlyReviewsThisWeek: 1, activeStudyDaysThisWeek: 3, scheduledRecallSampleSize: 1, scheduledRecallRate: null });
  });

  it("builds a 12-week activity grid with local calendar days and excludes future cells from totals", () => {
    const logs: ReviewLogSummary[] = [
      { id: "past", problem_id: card().id, rating: "good", reviewed_at: "2026-09-23T23:30:00.000Z", note: null, previous_due_at: null, next_due_at: "2026-09-27T08:00:00.000Z", scheduled_days: 3, event_kind: "first_attempt" },
    ];
    const days = activityForWeeks(logs, "Europe/Berlin", new Date("2026-09-24T12:00:00.000Z"));
    expect(days).toHaveLength(84);
    expect(days[0]?.key).toBe("2026-07-06");
    expect(days[0]?.isFuture).toBe(false);
    expect(days.at(-1)?.key).toBe("2026-09-27");
    expect(days.at(-1)?.isFuture).toBe(true);
    expect(activitySummaryForDays(days)).toMatchObject({ activeDays: 1, totalEvents: 1, firstAttempts: 1 });
  });

  it("groups review outcomes by local Monday weeks and excludes early, first, future, and undone events", () => {
    const common = { problem_id: card().id, note: null, previous_due_at: "2026-09-20T12:00:00.000Z", next_due_at: "2026-09-24T12:00:00.000Z", scheduled_days: 3 };
    const logs: ReviewLogSummary[] = [
      { ...common, id: "mon-local", rating: "hard", reviewed_at: "2026-09-20T22:30:00.000Z", event_kind: "scheduled_review" },
      { ...common, id: "sun-local", rating: "again", reviewed_at: "2026-09-20T20:30:00.000Z", event_kind: "scheduled_review" },
      { ...common, id: "early", rating: "good", reviewed_at: "2026-09-22T10:00:00.000Z", event_kind: "early_review" },
      { ...common, id: "attempt", rating: "good", reviewed_at: "2026-09-22T10:00:00.000Z", event_kind: "first_attempt" },
      { ...common, id: "undone", rating: "again", reviewed_at: "2026-09-22T10:00:00.000Z", event_kind: "scheduled_review", reversed_at: "2026-09-22T10:01:00.000Z" },
      { ...common, id: "future", rating: "again", reviewed_at: "2026-09-25T10:00:00.000Z", event_kind: "scheduled_review" },
    ];
    const weeks = recallOutcomesForWeeks(logs, "Europe/Berlin", new Date("2026-09-24T12:00:00.000Z"));
    expect(weeks).toHaveLength(12);
    expect(weeks.at(-1)?.weekKey).toBe("2026-09-21");
    expect(weeks.at(-1)).toMatchObject({ recalledCount: 1, forgotCount: 0, sampleSize: 1, isCurrentWeek: true });
    expect(weeks.at(-2)).toMatchObject({ recalledCount: 0, forgotCount: 1, sampleSize: 1 });
  });

  it("prioritizes due cards ahead of recent hard cards in reinforcement", () => {
    const due = card({ id: "00000000-0000-4000-8000-000000000004", card: { ...card().card, due_at: "2026-09-24T20:00:00.000Z" } });
    const hard = card({ id: "00000000-0000-4000-8000-000000000005", latest_rating: "hard", card: { ...card().card, due_at: "2026-09-29T20:00:00.000Z" } });
    expect(attentionProblems([hard, due], new Date("2026-09-24T10:00:00.000Z"), "UTC")[0].id).toBe(due.id);
  });
});
