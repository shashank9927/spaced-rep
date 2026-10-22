import { describe, expect, it } from "vitest";
import { isReviewUndoAvailable, shouldKeepReviewUndo, REVIEW_UNDO_WINDOW_MS, reviewUndoExpiresAt } from "@/lib/review-undo";

describe("review undo window", () => {
  it("keeps a retryable Undo until expiry but clears definitive failures", () => {
    expect(shouldKeepReviewUndo(2000, { retryable: true }, 1000)).toBe(true);
    expect(shouldKeepReviewUndo(2000, { retryable: false }, 1000)).toBe(false);
    expect(shouldKeepReviewUndo(2000, { retryable: true }, 2000)).toBe(false);
  });
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
