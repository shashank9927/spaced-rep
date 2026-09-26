import { describe, expect, it } from "vitest";
import { isReviewUndoAvailable, REVIEW_UNDO_WINDOW_MS, reviewUndoExpiresAt } from "@/lib/review-undo";

describe("review undo window", () => {
  it("expires exactly ten minutes after the authoritative review timestamp", () => {
    const reviewedAt = "2026-09-26T10:00:00.000Z";
    expect(reviewUndoExpiresAt(reviewedAt)).toBe(new Date(reviewedAt).getTime() + REVIEW_UNDO_WINDOW_MS);
  });

  it("is available before expiry and unavailable at expiry", () => {
    const expiresAt = 1_000_000;
    expect(isReviewUndoAvailable(expiresAt, expiresAt - 1)).toBe(true);
    expect(isReviewUndoAvailable(expiresAt, expiresAt)).toBe(false);
    expect(isReviewUndoAvailable(Number.NaN, 0)).toBe(false);
  });
});
