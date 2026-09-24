import { describe, expect, it } from "vitest";
import { intervalLabel, ratingOptions, retrievability, scheduleCard } from "@/lib/scheduler";
import type { FsrsCardState } from "@/lib/types";

const now = new Date("2026-09-23T10:00:00.000Z");

describe("FSRS review scheduling", () => {
  it("offers every recall rating for a new solved problem", () => {
    expect(ratingOptions(null, now).map((choice) => choice.rating)).toEqual(["again", "hard", "good", "easy"]);
  });

  it("schedules a first solve into a persistent review state", () => {
    const first = scheduleCard(null, "good", now);
    expect(first.next.reps).toBe(1);
    expect(first.next.due.getTime()).toBeGreaterThan(now.getTime());
  });

  it("uses day-sized initial intervals for coding attempts", () => {
    expect(ratingOptions(null, now).map((choice) => choice.intervalLabel)).toEqual(["1d", "2d", "3d", "8d"]);
  });

  it("schedules a repeated review from the saved database card", () => {
    const first = scheduleCard(null, "good", now).next;
    const saved: FsrsCardState = {
      due: first.due.toISOString(), stability: first.stability, difficulty: first.difficulty,
      elapsed_days: first.elapsed_days, scheduled_days: first.scheduled_days,
      learning_steps: first.learning_steps, reps: first.reps, lapses: first.lapses,
      state: first.state, last_review: first.last_review?.toISOString(),
    };
    const second = scheduleCard(saved, "easy", new Date(first.due));
    expect(second.next.reps).toBeGreaterThan(first.reps);
    expect(second.next.due.getTime()).toBeGreaterThan(new Date(first.due).getTime());
  });

  it("expands a later Good interval and reduces it after Forgot", () => {
    const first = scheduleCard(null, "good", now).next;
    const saved = {
      due: first.due.toISOString(), stability: first.stability, difficulty: first.difficulty,
      elapsed_days: first.elapsed_days, scheduled_days: first.scheduled_days,
      learning_steps: first.learning_steps, reps: first.reps, lapses: first.lapses,
      state: first.state, last_review: first.last_review?.toISOString(),
    } satisfies FsrsCardState;
    const good = scheduleCard(saved, "good", new Date(first.due));
    const forgot = scheduleCard(saved, "again", new Date(first.due));
    expect(good.next.scheduled_days).toBeGreaterThan(first.scheduled_days);
    expect(forgot.next.scheduled_days).toBeLessThan(good.next.scheduled_days);
  });

  it("formats short and long review intervals", () => {
    expect(intervalLabel(now, new Date("2026-09-23T10:10:00.000Z"))).toBe("10m");
    expect(intervalLabel(now, new Date("2026-09-26T10:00:00.000Z"))).toBe("3d");
  });

  it("returns an FSRS recall estimate for a saved card", () => {
    const next = scheduleCard(null, "good", now).next;
    const saved: FsrsCardState = {
      due: next.due.toISOString(), stability: next.stability, difficulty: next.difficulty,
      elapsed_days: next.elapsed_days, scheduled_days: next.scheduled_days,
      learning_steps: next.learning_steps, reps: next.reps, lapses: next.lapses,
      state: next.state, last_review: next.last_review?.toISOString(),
    };
    expect(retrievability(saved, now)).toBeGreaterThan(0);
  });
});
