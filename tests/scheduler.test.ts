import { describe, expect, it } from "vitest";
import { intervalLabel, ratingOptions, scheduleCard } from "@/lib/scheduler";
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

  it("formats short and long review intervals", () => {
    expect(intervalLabel(now, new Date("2026-09-23T10:10:00.000Z"))).toBe("10m");
    expect(intervalLabel(now, new Date("2026-09-26T10:00:00.000Z"))).toBe("3d");
  });
});
