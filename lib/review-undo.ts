export const REVIEW_UNDO_WINDOW_MS = 10 * 60_000;

export function reviewUndoExpiresAt(reviewedAt: string | number | Date) {
  const timestamp = reviewedAt instanceof Date ? reviewedAt.getTime() : typeof reviewedAt === "number" ? reviewedAt : new Date(reviewedAt).getTime();
  return timestamp + REVIEW_UNDO_WINDOW_MS;
}

export function isReviewUndoAvailable(expiresAt: number, now = Date.now()) {
  return Number.isFinite(expiresAt) && expiresAt > now;
}

export function shouldKeepReviewUndo(expiresAt: number, failure: { retryable: boolean }, now = Date.now()) {
  return failure.retryable && isReviewUndoAvailable(expiresAt, now);
}
