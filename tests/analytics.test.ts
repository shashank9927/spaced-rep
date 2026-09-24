import { describe, expect, it } from "vitest";
import { isStrong, isWeak, queueOrder } from "@/lib/analytics";
import type { StudyCard } from "@/lib/analytics";

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
});
